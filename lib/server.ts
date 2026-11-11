import {cookies} from 'next/headers';
import {getDb} from './db';
import {storage} from './storage';
import {hashPassword, newToken, tokenId} from './auth';
import {formatWorkModels, parseWorkModels, type WorkModelId} from './model';

export const db = () => getDb();
export const bucket = () => storage;
export const SESSION_COOKIE = 'gy_session';
const SESSION_DAYS = 7;
export const today = () => new Date().toISOString().slice(0, 10);

export type Ctx = {user: {userId: string; email: string; role: string} | null; admin: boolean; member: any};
const anonymous: Ctx = {user: null, admin: false, member: null};

// İlk çalıştırmada .env içindeki ADMIN_EMAIL / ADMIN_PASSWORD ile yönetici hesabı oluşturulur.
let adminReady: Promise<void> | null = null;
export function ensureAdmin() {
  if (!adminReady) {
    adminReady = (async () => {
      const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const password = String(process.env.ADMIN_PASSWORD || '');
      if (!email || !password) return;
      const exists = await db().prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").first();
      if (exists) return;
      await db()
        .prepare('INSERT OR IGNORE INTO users (id, email, password_hash, role, member_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), email, await hashPassword(password), 'admin', null, new Date().toISOString())
        .run();
    })().catch((e) => {
      adminReady = null;
      throw e;
    });
  }
  return adminReady;
}

export async function identityFromToken(token?: string | null): Promise<Ctx> {
  if (!token || token.length > 200) return anonymous;
  const row: any = await db()
    .prepare('SELECT u.id, u.email, u.role, u.member_id, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?')
    .bind(await tokenId(token))
    .first();
  if (!row || row.expires_at < new Date().toISOString()) return anonymous;
  const user = {userId: row.id, email: row.email, role: row.role};
  if (row.role === 'admin') return {user, admin: true, member: null};
  const member = row.member_id ? await db().prepare('SELECT * FROM members WHERE id = ?').bind(row.member_id).first() : null;
  return {user, admin: false, member};
}

export async function identity(): Promise<Ctx> {
  await ensureAdmin();
  const store = await cookies();
  return identityFromToken(store.get(SESSION_COOKIE)?.value);
}

export async function createSession(userId: string) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const now = new Date().toISOString();
  await db().prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  await db()
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await tokenId(token), userId, expires.toISOString(), now)
    .run();
  return {token, expires};
}

export async function destroySession(token?: string | null) {
  if (token) await db().prepare('DELETE FROM sessions WHERE id = ?').bind(await tokenId(token)).run();
}

export function isSecure(r: Request) {
  return new URL(r.url).protocol === 'https:' || r.headers.get('x-forwarded-proto') === 'https';
}

export function sessionCookie(token: string, expires: Date, secure: boolean) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure: boolean) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function readCookie(r: Request, name: string) {
  const header = r.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

// Firma yalnızca onaylıysa, süresi dolmadıysa ve kullanım koşullarını kabul ettiyse veri görebilir.
export function permitted(c: Ctx) {
  return c.admin || !!(c.member && c.member.status === 'approved' && c.member.expires >= today() && c.member.terms);
}

// Firma bir mezunu yalnızca yönetici o CV'yi firmaya açtıysa ve profil yayındaysa görebilir.
export async function canSee(c: Ctx, profileId: unknown): Promise<any | null> {
  if (typeof profileId !== 'string' || profileId.length > 100) return null;
  if (c.admin) return db().prepare('SELECT * FROM profiles WHERE id = ?').bind(profileId).first();
  if (!permitted(c)) return null;
  return db()
    .prepare("SELECT p.* FROM member_profiles mp JOIN profiles p ON p.id = mp.profile_id WHERE mp.member_id = ? AND mp.profile_id = ? AND p.status = 'published' AND p.evidence <> ''")
    .bind(c.member.id, profileId)
    .first();
}

export async function audit(c: Ctx, action: string, target = '') {
  await db()
    .prepare('INSERT INTO events (id, actor, company, action, target, at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), c.user?.email || 'anonim', c.member?.company || 'Akademi', action, target, new Date().toISOString())
    .run();
}

export async function notify(n: {type: string; memberId?: string; refId?: string; candidateId?: string; title: string; body?: string; actorEmail?: string}) {
  await db()
    .prepare('INSERT INTO notifications (id, type, member_id, ref_id, candidate_id, title, body, actor_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), n.type, n.memberId || null, n.refId || null, n.candidateId || null, n.title.slice(0, 300), (n.body || '').slice(0, 2000), n.actorEmail || '', new Date().toISOString())
    .run();
}

// Basit sabit pencereli istek sınırı. true dönerse istek kabul edilir.
export async function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const row: any = await db().prepare('SELECT count, window_start FROM rate_limits WHERE key = ?').bind(key).first();
  if (!row || now - row.window_start > windowMs) {
    await db().prepare('INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start').bind(key, now).run();
    return true;
  }
  if (row.count >= max) return false;
  await db().prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

export async function resetRate(key: string) {
  await db().prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
}

export function clientIp(r: Request) {
  return (r.headers.get('x-forwarded-for') || '').split(',')[0].trim() || r.headers.get('x-real-ip') || 'local';
}

// Aktif program menüsü (Program > Alan).
export async function loadCatalog(includeInactive = false) {
  const where = includeInactive ? '' : ' WHERE active = 1';
  const programs = (await db().prepare('SELECT * FROM programs' + where + ' ORDER BY sort, name').all()).results;
  const areas = (await db().prepare('SELECT * FROM program_areas' + where + ' ORDER BY sort, name').all()).results;
  return programs.map((p: any) => ({...p, active: !!p.active, areas: areas.filter((a: any) => a.program_id === p.id).map((a: any) => ({...a, active: !!a.active}))}));
}

// Talep kalemlerini doğrular: [{programId, areaId, quota}]
export async function cleanItems(items: unknown, opts: {allowEmpty?: boolean} = {}) {
  if (!Array.isArray(items) || items.length > 60) throw new Error('En az bir program / alan seçin.');
  if (!items.length) {
    if (opts.allowEmpty) return [] as {programId: string; areaId: string; quota: number}[];
    throw new Error('En az bir program / alan seçin.');
  }
  const catalog = await loadCatalog();
  const seen = new Set<string>();
  return items.map((item: any) => {
    const program = catalog.find((p: any) => p.id === item?.programId);
    if (!program) throw new Error('Seçilen program artık aktif değil.');
    const areaId = String(item.areaId || '');
    if (program.areas.length && !program.areas.some((a: any) => a.id === areaId)) throw new Error(program.name + ' için geçerli bir alan seçin.');
    if (!program.areas.length && areaId) throw new Error('Alan seçimi geçersiz.');
    const quota = Number(item.quota);
    if (!Number.isInteger(quota) || quota < 1 || quota > 999) throw new Error('Kontenjan 1 ile 999 arasında bir sayı olmalıdır.');
    const key = program.id + '|' + areaId;
    if (seen.has(key)) throw new Error('Aynı alan birden fazla seçilmiş.');
    seen.add(key);
    return {programId: program.id, areaId, quota};
  });
}

// Formdaki "Diğer Teknoloji Alanları" serbest talebi. Kapalıysa null.
export function cleanOther(raw: unknown): {label: string; quota: number} | null {
  if (!raw || typeof raw !== 'object' || (raw as any).enabled !== true) return null;
  const label = String((raw as any).label ?? '').trim().slice(0, 200);
  const quota = Number((raw as any).quota);
  if (!label) throw new Error('İhtiyaç duyulan teknoloji / uzmanlık alanını yazın.');
  if (!Number.isInteger(quota) || quota < 1 || quota > 999) throw new Error('Talep edilen CV sayısı 1 ile 999 arasında bir sayı olmalıdır.');
  return {label, quota};
}

export function describeOther(other: {label: string; quota: number} | null | undefined) {
  if (!other?.label) return '';
  return 'Diğer › ' + other.label + ' (kontenjan ' + other.quota + ')';
}

export function cleanWorkModels(raw: unknown): WorkModelId[] {
  const models = parseWorkModels(raw);
  if (!models.length) throw new Error('Lütfen en az bir çalışma modeli seçiniz.');
  return models;
}
export function describeWorkModels(models: string[] | null | undefined) {
  const text = formatWorkModels(models || []);
  return text ? 'Çalışma modeli: ' + text : '';
}

export function json(x: any, status = 200, headers: Record<string, string> = {}) {
  return Response.json(x, {status, headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers}});
}

export function originOK(r: Request) {
  const o = r.headers.get('origin');
  if (!o) return true;
  const url = new URL(r.url);
  const host = r.headers.get('x-forwarded-host') || r.headers.get('host') || url.host;
  try {
    return new URL(o).host === host;
  } catch {
    return false;
  }
}

// Firma listelerinde gösterilmeyen iletişim alanları.
export const PRIVATE_FIELDS = ['phone', 'email', 'cvSource'];
export function publicProfile(row: any, extra: Record<string, unknown> = {}) {
  const payload = JSON.parse(row.payload);
  const out: any = {...payload, id: row.id, status: row.status, hasCv: !!row.cvkey || !!payload.cvSource, updated: row.updated, ...extra};
  for (const k of PRIVATE_FIELDS) delete out[k];
  return out;
}

// Talep kalemlerini okunur metne çevirir: "Program › Alan (kontenjan 7)"
export async function describeItems(items: {programId: string; areaId: string; quota: number}[], other?: {label: string; quota: number} | null, workModels?: string[] | null) {
  const catalog = await loadCatalog(true);
  const lines = items.map((i) => {
    const p: any = catalog.find((x: any) => x.id === i.programId);
    const a: any = p?.areas.find((x: any) => x.id === i.areaId);
    return (p?.name || 'Silinmiş program') + (a ? ' › ' + a.name : '') + ' (kontenjan ' + i.quota + ')';
  });
  const extra = describeOther(other);
  if (extra) lines.push(extra);
  const work = describeWorkModels(workModels);
  if (work) lines.push(work);
  return lines.join('\n');
}

// Firma geçmişine kayıt ekler. Sistem olayları takip durumunu değiştirmez.
export async function activity(memberId: string, note: string, by = 'Sistem') {
  await db()
    .prepare('INSERT INTO firm_activities (id, member_id, kind, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), memberId, 'system', note.slice(0, 2000), by, new Date().toISOString())
    .run();
}

export const followupDays = () => {
  const n = Number(process.env.FOLLOWUP_DAYS || 7);
  return Number.isInteger(n) && n > 0 && n < 366 ? n : 7;
};
