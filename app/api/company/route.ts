import {db, identity, permitted, canSee, audit, json, originOK, loadCatalog, cleanItems, cleanOther, cleanWorkModels, describeItems, notify, publicProfile, activity} from '../../../lib/server';
import {stages, PENDING_STAGE, parseWorkModels} from '../../../lib/model';
export const dynamic = 'force-dynamic';

const text = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const parsePlacement = (x: any) => ({...JSON.parse(x.payload), id: x.id, candidate: x.candidate, updated: x.updated});

function activeCatalog(catalog: any[]) {
  return catalog.filter((p: any) => p.active).map((p: any) => ({id: p.id, name: p.name, areas: p.areas.filter((a: any) => a.active).map((a: any) => ({id: a.id, name: a.name}))}));
}

function memberPublic(m: any) {
  return {id: m.id, company: m.company, name: m.name, title: m.title, email: m.email, phone: m.phone, website: m.website, city: m.city, expires: m.expires, status: m.status};
}

async function loadRequests(memberId: string) {
  const requests = await db().prepare('SELECT id, type, items, note, status, created_at, decided_at, other_label, other_quota, work_models FROM access_requests WHERE member_id = ? ORDER BY created_at DESC').bind(memberId).all();
  return requests.results.map((x: any) => ({...x, items: JSON.parse(x.items), work_models: parseWorkModels(x.work_models)}));
}

async function createProgramRequest(c: any, b: any, {updateProfile = false}: {updateProfile?: boolean} = {}) {
  const m = c.member;
  const now = new Date().toISOString();
  const other = cleanOther(b.other);
  const items = await cleanItems(b.items, {allowEmpty: !!other});
  if (!items.length && !other) throw new Error('En az bir program / alan seçin veya diğer teknoloji alanı talebi oluşturun.');
  const workModels = cleanWorkModels(b.workModels);
  const pending = await db().prepare("SELECT COUNT(*) AS n FROM access_requests WHERE member_id = ? AND status = 'pending'").bind(m.id).first<any>();
  if (pending && pending.n >= 5) throw new Error('Sonuçlanmamış en fazla 5 talebiniz olabilir.');

  if (updateProfile) {
    const company = text(b.company) || m.company;
    const name = text(b.name) || m.name;
    const title = text(b.title);
    const phone = text(b.phone, 40);
    const website = text(b.website);
    const city = text(b.city, 100);
    if (!company || !name) throw new Error('Firma ünvanı ve yetkili ad-soyad gereklidir.');
    if (phone && !/^[+0-9 ()-]{7,40}$/.test(phone)) throw new Error('Geçerli bir telefon numarası girin.');
    if (website && !/^https?:\/\/\S+$/i.test(website)) throw new Error('Web sitesi http:// veya https:// ile başlamalıdır.');
    await db().prepare('UPDATE members SET company = ?, name = ?, title = ?, phone = ?, website = ?, city = ? WHERE id = ?')
      .bind(company, name, title, phone, website, city, m.id).run();
    Object.assign(m, {company, name, title, phone, website, city});
  }

  const id = crypto.randomUUID();
  const note = text(b.note, 2000);
  const summary = await describeItems(items, other, workModels);
  await db().prepare('INSERT INTO access_requests (id, member_id, type, items, note, status, created_at, other_label, other_quota, work_models) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, m.id, 'program', JSON.stringify(items), note, 'pending', now, other?.label || '', other?.quota || 0, JSON.stringify(workModels)).run();
  await notify({type: 'program_request', memberId: m.id, refId: id, actorEmail: c.user.email, title: m.company + ' yeni CV talebi oluşturdu', body: summary});
  await activity(m.id, 'Firma yeni CV talebi oluşturdu:\n' + summary, c.user.email);
  await audit(c, 'CV talebi', id);
  return {ok: true, id, member: memberPublic(m)};
}

// Firma paneli: onaylı firmaya tam veri; onaysız firmaya yalnızca talep listesi + katalog.
export async function GET(r: Request) {
  try {
    const c = await identity();
    if (!c.user) return json({error: 'Giriş yapmanız gerekiyor.'}, 401);
    if (c.admin || !c.member) return json({error: 'Bu alan firma kullanıcıları içindir.'}, 403);
    const m = c.member;
    const catalog = await loadCatalog(true);

    if (!permitted(c)) {
      return json({
        role: 'company',
        gate: 'requests',
        email: c.user.email,
        member: memberPublic(m),
        requests: await loadRequests(m.id),
        catalog: activeCatalog(catalog),
        allPrograms: catalog.map((p: any) => ({id: p.id, name: p.name, areas: p.areas.map((a: any) => ({id: a.id, name: a.name}))})),
      });
    }

    const [profiles, placements, grants, requests] = await Promise.all([
      db().prepare("SELECT p.*, mp.grant_id FROM member_profiles mp JOIN profiles p ON p.id = mp.profile_id WHERE mp.member_id = ? AND p.status = 'published' AND p.evidence <> '' ORDER BY mp.granted_at DESC").bind(m.id).all(),
      db().prepare('SELECT * FROM placements WHERE member = ? ORDER BY updated DESC').bind(m.id).all(),
      db().prepare('SELECT * FROM member_grants WHERE member_id = ? ORDER BY granted_at').bind(m.id).all(),
      loadRequests(m.id),
    ]);
    const places = placements.results.map(parsePlacement);
    return json({
      role: 'company',
      email: c.user.email,
      member: memberPublic(m),
      profiles: profiles.results.map((p: any) => {
        const place = places.find((x: any) => x.candidate === p.id);
        return publicProfile(p, {grantId: p.grant_id, contactEmail: place?.approved ? JSON.parse(p.payload).email : undefined});
      }),
      placements: places,
      grants: grants.results,
      requests,
      catalog: activeCatalog(catalog),
      allPrograms: catalog.map((p: any) => ({id: p.id, name: p.name, areas: p.areas.map((a: any) => ({id: a.id, name: a.name}))})),
    });
  } catch {
    return json({error: 'Veri bağlantısı kurulamadı. Lütfen yeniden deneyin.'}, 503);
  }
}

export async function POST(r: Request) {
  try {
    if (!originOK(r)) return json({error: 'İstek kaynağı geçersiz.'}, 403);
    const c = await identity();
    if (!c.user) return json({error: 'Giriş yapmanız gerekiyor.'}, 401);
    if (c.admin || !c.member) return json({error: 'Bu işlem firma kullanıcıları içindir.'}, 403);
    const b: any = await r.json();
    const now = new Date().toISOString();
    const m = c.member;

    // Onaysız firmalar da yeni CV talebi oluşturabilir.
    if (b.action === 'cv-request') {
      return json(await createProgramRequest(c, b, {updateProfile: true}));
    }

    if (!permitted(c)) return json({error: 'Firma erişiminiz aktif değil.'}, 403);

    if (b.action === 'detail') {
      const p = await canSee(c, b.id);
      if (!p) return json({error: 'Profil erişime açık değil.'}, 404);
      const place: any = await db().prepare('SELECT payload FROM placements WHERE member = ? AND candidate = ?').bind(m.id, p.id).first();
      const approved = place && JSON.parse(place.payload).approved;
      await audit(c, 'Profil görüntüleme', p.id);
      return json({profile: publicProfile(p, {contactEmail: approved ? JSON.parse(p.payload).email : undefined})});
    }

    if (b.action === 'hire') {
      const p = await canSee(c, b.candidate);
      if (!p) return json({error: 'Öğrenci erişime açık değil.'}, 404);
      const existing: any = await db().prepare('SELECT * FROM placements WHERE member = ? AND candidate = ?').bind(m.id, p.id).first();
      if (existing) return json({ok: true, created: false, placement: parsePlacement(existing)});
      const id = crypto.randomUUID();
      const payload = {stage: PENDING_STAGE, role: text(b.role), start: '', verified: false, firstJob: false, woman: false, confirmed3: false, approved: false, requestedAt: now, requestedBy: c.user.email};
      await db().prepare('INSERT INTO placements (id, member, candidate, payload, updated) VALUES (?, ?, ?, ?, ?)').bind(id, m.id, p.id, JSON.stringify(payload), now).run();
      const profile = JSON.parse(p.payload);
      await notify({type: 'hiring_request', memberId: m.id, refId: id, candidateId: p.id, actorEmail: c.user.email, title: m.company + ' bir öğrenciyi işe alım sürecine eklemek istiyor', body: profile.name + ' · ' + (profile.program || '') + (profile.classGroup ? ' › ' + profile.classGroup : '') + (payload.role ? '\nPozisyon: ' + payload.role : '')});
      await activity(m.id, 'Firma işe alım talebi gönderdi: ' + profile.name + (payload.role ? ' (' + payload.role + ')' : ''), c.user.email);
      await audit(c, 'İşe alım sürecine ekleme talebi', p.id);
      return json({ok: true, created: true, placement: {...payload, id, candidate: p.id, updated: now}});
    }

    if (b.action === 'stage') {
      const row: any = await db().prepare('SELECT * FROM placements WHERE id = ? AND member = ?').bind(String(b.id || ''), m.id).first();
      if (!row) return json({error: 'Kayıt bulunamadı.'}, 404);
      const payload = JSON.parse(row.payload);
      if (!payload.approved) throw new Error('Bu kayıt henüz yönetim onayı bekliyor.');
      if (!(await canSee(c, row.candidate))) return json({error: 'Öğrenci erişime açık değil.'}, 404);
      if (!stages.includes(b.stage)) throw new Error('Aşama geçersiz.');
      if (b.stage === 'İşe başladı' && !/^\d{4}-\d{2}-\d{2}$/.test(b.start || '')) throw new Error('İşe başlama tarihi gerekli.');
      Object.assign(payload, {stage: b.stage, role: text(b.role), start: b.start || '', firstJob: !!b.firstJob, woman: !!b.woman});
      await db().prepare('UPDATE placements SET payload = ?, updated = ? WHERE id = ?').bind(JSON.stringify(payload), now, row.id).run();
      if (b.stage !== JSON.parse(row.payload).stage) await activity(m.id, 'Firma işe alım aşamasını güncelledi: ' + b.stage, c.user.email);
      await audit(c, 'İşe alım aşaması güncellendi: ' + b.stage, row.candidate);
      return json({ok: true});
    }

    if (b.action === 'program-request') {
      return json(await createProgramRequest(c, b));
    }

    return json({error: 'İşlem bulunamadı.'}, 400);
  } catch (e: any) {
    return json({error: e.message || 'İşlem tamamlanamadı.'}, 400);
  }
}
