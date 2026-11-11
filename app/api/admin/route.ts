import {db, bucket, identity, audit, json, originOK, loadCatalog, cleanItems, describeItems, activity, followupDays} from '../../../lib/server';
import {hashPassword, passwordProblem} from '../../../lib/auth';
import {cleanProfile, stages, PENDING_STAGE, REJECTED_STAGE, followStatuses, followChannels, followLabel, channelLabel, parseWorkModels} from '../../../lib/model';
export const dynamic = 'force-dynamic';

const text = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
function idList(ids: unknown, max = 500): string[] {
  if (!Array.isArray(ids) || !ids.length || ids.length > max || ids.some((id) => typeof id !== 'string' || id.length > 100)) throw new Error('1–' + max + ' kayıt seçilmelidir.');
  return [...new Set(ids as string[])];
}
const parsePlacement = (x: any) => ({...JSON.parse(x.payload), id: x.id, candidate: x.candidate, member: x.member, updated: x.updated});

// Yönetim paneli verisi: yalnızca admin rolü.
export async function GET(r: Request) {
  try {
    const c = await identity();
    if (!c.user) return json({error: 'Giriş yapmanız gerekiyor.'}, 401);
    if (!c.admin) return json({error: 'Yönetici yetkisi gerekli.'}, 403);
    const q = (sql: string) => db().prepare(sql).all().then((x) => x.results as any[]);
    const [profiles, members, requests, grants, assignments, placements, events, activities, catalog] = await Promise.all([
      q('SELECT * FROM profiles ORDER BY updated DESC'),
      q('SELECT * FROM members ORDER BY created_at DESC, company'),
      q('SELECT * FROM access_requests ORDER BY created_at DESC'),
      q('SELECT * FROM member_grants ORDER BY granted_at'),
      q('SELECT member_id, profile_id, grant_id, granted_at FROM member_profiles'),
      q('SELECT * FROM placements ORDER BY updated DESC'),
      q('SELECT * FROM events ORDER BY at DESC LIMIT 100'),
      q('SELECT * FROM firm_activities ORDER BY created_at DESC LIMIT 5000'),
      loadCatalog(true),
    ]);
    return json({
      role: 'admin',
      email: c.user.email,
      appUrl: (process.env.APP_URL || new URL(r.url).origin).replace(/\/$/, ''),
      profiles: profiles.map((p) => {
        const payload = JSON.parse(p.payload);
        return {...payload, id: p.id, status: p.status, evidence: p.evidence, hasCv: !!p.cvkey || !!payload.cvSource, updated: p.updated};
      }),
      members: members.map(({uid, scopes, ...m}) => m),
      requests: requests.map((x) => ({...x, items: JSON.parse(x.items), work_models: parseWorkModels(x.work_models)})),
      grants,
      assignments,
      placements: placements.map(parsePlacement),
      events,
      activities,
      followupDays: followupDays(),
      catalog,
    });
  } catch {
    return json({error: 'Veri bağlantısı kurulamadı. Lütfen yeniden deneyin.'}, 503);
  }
}

async function deleteProfiles(ids: string[]) {
  const ph = ids.map(() => '?').join(',');
  const rows = (await db().prepare('SELECT cvkey FROM profiles WHERE id IN (' + ph + ')').bind(...ids).all()).results as any[];
  await db().batch([
    db().prepare('DELETE FROM profiles WHERE id IN (' + ph + ')').bind(...ids),
    db().prepare('DELETE FROM placements WHERE candidate IN (' + ph + ')').bind(...ids),
    db().prepare('DELETE FROM contacts WHERE candidate IN (' + ph + ')').bind(...ids),
    db().prepare('DELETE FROM member_profiles WHERE profile_id IN (' + ph + ')').bind(...ids),
    db().prepare('DELETE FROM notifications WHERE candidate_id IN (' + ph + ')').bind(...ids),
  ]);
  for (const row of rows) if (row.cvkey) await bucket().delete(row.cvkey);
}

async function upsertGrants(memberId: string, items: {programId: string; areaId: string; quota: number}[], requestId: string | null, now: string) {
  return db().batch(items.map((i) =>
    db().prepare('INSERT INTO member_grants (id, member_id, program_id, area_id, quota, request_id, granted_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(member_id, program_id, area_id) DO UPDATE SET quota = excluded.quota, request_id = COALESCE(excluded.request_id, member_grants.request_id)')
      .bind(crypto.randomUUID(), memberId, i.programId, i.areaId, i.quota, requestId, now)));
}

export async function POST(r: Request) {
  try {
    if (!originOK(r)) return json({error: 'İstek kaynağı geçersiz.'}, 403);
    if (Number(r.headers.get('content-length') || 0) > 3e6) return json({error: 'İstek çok büyük.'}, 413);
    const c = await identity();
    if (!c.user) return json({error: 'Giriş yapmanız gerekiyor.'}, 401);
    if (!c.admin) return json({error: 'Yönetici yetkisi gerekli.'}, 403);
    const b: any = await r.json();
    const now = new Date().toISOString();

    // ---- Mezunlar ----
    if (b.action === 'publish-pending') {
      const evidence = String(b.evidence || '').trim();
      if (!evidence || evidence.length > 2000) throw new Error('Ortak izin / belge referansı girin (en fazla 2000 karakter).');
      const ids = idList(b.ids);
      const results = await db().batch(ids.map((id) => db().prepare('UPDATE profiles SET status = ?, evidence = ?, updated = ? WHERE id = ? AND status = ?').bind('published', evidence, now, id, 'pending')));
      const count = results.reduce((n, x) => n + x.meta.changes, 0);
      await audit(c, 'Toplu yayın: ' + count + ' mezun', JSON.stringify(ids));
      return json({ok: true, count});
    }
    if (b.action === 'profile') {
      const p = cleanProfile(b.profile);
      const id = b.profile.id || crypto.randomUUID();
      const status = ['pending', 'published', 'hidden'].includes(b.profile.status) ? b.profile.status : 'pending';
      const evidence = String(b.profile.evidence || '').trim().slice(0, 2000);
      if (status === 'published' && !evidence) throw new Error('Yayın için paylaşım dayanağı / belge referansı zorunludur.');
      await db().prepare('INSERT INTO profiles (id, email, payload, status, evidence, updated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, payload = excluded.payload, status = excluded.status, evidence = excluded.evidence, updated = excluded.updated').bind(id, p.email, JSON.stringify(p), status, evidence, now).run();
      await audit(c, 'Mezun kaydı güncellendi', id);
      return json({ok: true, id});
    }
    if (b.action === 'import') {
      if (!Array.isArray(b.rows) || b.rows.length > 500) throw new Error('En fazla 500 satır aktarılabilir.');
      const rows = b.rows.map(cleanProfile);
      for (let i = 0; i < rows.length; i++) {
        if (b.rows[i]._preservePeriod === true) {
          const existing: any = await db().prepare('SELECT payload FROM profiles WHERE email = ?').bind(rows[i].email).first();
          if (existing) rows[i].period = JSON.parse(existing.payload).period || '';
        }
      }
      if (new Set(rows.map((x: any) => x.email)).size !== rows.length) throw new Error('Dosyada mükerrer e-posta var.');
      const statements = rows.map((p: any) => db().prepare("INSERT INTO profiles (id, email, payload, status, evidence, updated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET payload = excluded.payload, status = 'pending', evidence = '', updated = excluded.updated").bind(crypto.randomUUID(), p.email, JSON.stringify(p), 'pending', '', now));
      if (statements.length) await db().batch(statements);
      await audit(c, 'Toplu yükleme: ' + rows.length + ' kayıt');
      return json({ok: true, count: rows.length});
    }
    if (b.action === 'delete-profiles') {
      const ids = idList(b.ids);
      await deleteProfiles(ids);
      await audit(c, ids.length === 1 ? 'Mezun kaydı silindi' : 'Toplu silme: ' + ids.length + ' mezun', JSON.stringify(ids));
      return json({ok: true, count: ids.length});
    }

    // ---- Firmalar ----
    if (b.action === 'member-save') {
      const f = {company: text(b.company), name: text(b.name), title: text(b.title), phone: text(b.phone, 40), website: text(b.website), city: text(b.city, 100)};
      if (!f.company || !f.name) throw new Error('Firma ve yetkili ad-soyad gereklidir.');
      if (!['pending', 'approved', 'suspended', 'rejected'].includes(b.status)) throw new Error('Geçersiz durum.');
      if (b.status === 'approved' && !isDate(b.expires)) throw new Error('Erişim bitiş tarihi gerekli.');
      if (b.id) {
        const m: any = await db().prepare('SELECT id, status FROM members WHERE id = ?').bind(b.id).first();
        if (!m) throw new Error('Firma bulunamadı.');
        await db().prepare('UPDATE members SET company = ?, name = ?, title = ?, phone = ?, website = ?, city = ?, status = ?, expires = ?, approved_at = CASE WHEN ? = \'approved\' THEN COALESCE(approved_at, ?) ELSE approved_at END WHERE id = ?').bind(f.company, f.name, f.title, f.phone, f.website, f.city, b.status, b.expires || '', b.status, now, b.id).run();
        if (m.status !== b.status) await activity(b.id, 'Firma durumu değişti: ' + ({pending: 'Onay bekliyor', approved: 'Onaylı', suspended: 'Durduruldu', rejected: 'Reddedildi'} as any)[b.status], c.user.email);
        await audit(c, 'Firma bilgisi güncellendi', b.id);
        return json({ok: true, id: b.id});
      }
      const email = text(b.email).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçerli bir e-posta girin.');
      const problem = passwordProblem(b.password);
      if (problem) throw new Error(problem);
      const exists = await db().prepare('SELECT id FROM users WHERE email = ? UNION SELECT id FROM members WHERE email = ?').bind(email, email).first();
      if (exists) throw new Error('Bu e-posta zaten kayıtlı.');
      const id = crypto.randomUUID();
      await db().batch([
        db().prepare('INSERT INTO members (id, email, company, name, status, expires, terms, scopes, title, phone, website, city, created_at, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, email, f.company, f.name, b.status, b.expires || '', now + ' / Yönetici tarafından eklendi', '[]', f.title, f.phone, f.website, f.city, now, b.status === 'approved' ? now : null),
        db().prepare('INSERT INTO users (id, email, password_hash, role, member_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), email, await hashPassword(b.password), 'company', id, now),
      ]);
      await activity(id, 'Firma yönetici tarafından eklendi', c.user.email);
      await audit(c, 'Firma kullanıcısı eklendi', id);
      return json({ok: true, id});
    }
    if (b.action === 'member-password') {
      const problem = passwordProblem(b.password);
      if (problem) throw new Error(problem);
      const user: any = await db().prepare("SELECT id FROM users WHERE member_id = ? AND role = 'company'").bind(String(b.id || '')).first();
      if (!user) throw new Error('Firma kullanıcısı bulunamadı.');
      await db().batch([
        db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(b.password), user.id),
        db().prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      ]);
      await audit(c, 'Firma şifresi yönetici tarafından belirlendi', b.id);
      return json({ok: true});
    }
    if (b.action === 'member-delete') {
      const id = String(b.id || '');
      const user: any = await db().prepare('SELECT id FROM users WHERE member_id = ?').bind(id).first();
      await db().batch([
        db().prepare('DELETE FROM members WHERE id = ?').bind(id),
        db().prepare('DELETE FROM users WHERE member_id = ?').bind(id),
        db().prepare('DELETE FROM sessions WHERE user_id = ?').bind(user?.id || ''),
        db().prepare('DELETE FROM member_grants WHERE member_id = ?').bind(id),
        db().prepare('DELETE FROM member_profiles WHERE member_id = ?').bind(id),
        db().prepare('DELETE FROM access_requests WHERE member_id = ?').bind(id),
        db().prepare('DELETE FROM placements WHERE member = ?').bind(id),
        db().prepare('DELETE FROM notifications WHERE member_id = ?').bind(id),
        db().prepare('DELETE FROM firm_activities WHERE member_id = ?').bind(id),
      ]);
      await audit(c, 'Firma kaydı silindi', id);
      return json({ok: true});
    }

    // ---- Firma takibi (admin'in elle yaptığı iletişim) ----
    if (b.action === 'followup-save') {
      const m: any = await db().prepare('SELECT id, follow_status FROM members WHERE id = ?').bind(String(b.id || '')).first();
      if (!m) throw new Error('Firma bulunamadı.');
      if (!followStatuses.some(([k]) => k === b.status)) throw new Error('Takip durumu geçersiz.');
      const channel = String(b.channel || '');
      if (channel && !followChannels.some(([k]) => k === channel)) throw new Error('İletişim kanalı geçersiz.');
      const contactedAt = b.contactedAt || now.slice(0, 10);
      if (!isDate(contactedAt) || contactedAt > now.slice(0, 10)) throw new Error('İletişim tarihi geçersiz (ileri tarih olamaz).');
      const next = String(b.nextFollowUp || '');
      if (next && !isDate(next)) throw new Error('Sonraki takip tarihi geçersiz.');
      const note = text(b.note, 2000);
      await db().batch([
        db().prepare('UPDATE members SET follow_status = ?, follow_updated_at = ?, next_follow_up = ? WHERE id = ?').bind(b.status, now, next, m.id),
        db().prepare('INSERT INTO firm_activities (id, member_id, kind, status, channel, note, contacted_at, next_follow_up, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), m.id, 'contact', b.status, channel, note, contactedAt, next, c.user.email, now),
      ]);
      await audit(c, 'Firma takibi: ' + followLabel(b.status) + (channel ? ' (' + channelLabel(channel) + ')' : ''), m.id);
      return json({ok: true});
    }

    // ---- Talepler ----
    if (b.action === 'request-approve') {
      const req: any = await db().prepare('SELECT * FROM access_requests WHERE id = ?').bind(String(b.id || '')).first();
      if (!req || req.status !== 'pending') throw new Error('Talep bulunamadı veya zaten sonuçlandırılmış.');
      const member: any = await db().prepare('SELECT * FROM members WHERE id = ?').bind(req.member_id).first();
      if (!member) throw new Error('Firma kaydı bulunamadı.');
      const other = req.other_label ? {label: String(req.other_label), quota: Number(req.other_quota) || 0} : null;
      const items = await cleanItems(b.items, {allowEmpty: !!other});
      if (!items.length && !other) throw new Error('En az bir alan seçin ya da talebi reddedin.');
      const expires = b.expires || member.expires;
      if (!isDate(expires)) throw new Error('Erişim bitiş tarihi gerekli.');
      if (items.length) await upsertGrants(member.id, items, req.id, now);
      await db().batch([
        db().prepare("UPDATE members SET status = 'approved', expires = ?, approved_at = COALESCE(approved_at, ?) WHERE id = ?").bind(expires, now, member.id),
        db().prepare("UPDATE access_requests SET status = 'approved', decided_at = ?, decision_note = ? WHERE id = ?").bind(now, text(b.note, 1000), req.id),
        db().prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE ref_id = ?').bind(now, req.id),
      ]);
      await activity(member.id, (req.type === 'initial' ? 'Başvuru onaylandı' : 'Ek program talebi onaylandı') + ' (erişim bitişi ' + expires + ')\n' + (await describeItems(items, other, parseWorkModels(req.work_models))), c.user.email);
      await audit(c, 'Firma talebi onaylandı', req.id);
      return json({ok: true, memberId: member.id});
    }
    if (b.action === 'request-reject') {
      const req: any = await db().prepare('SELECT * FROM access_requests WHERE id = ?').bind(String(b.id || '')).first();
      if (!req || req.status !== 'pending') throw new Error('Talep bulunamadı veya zaten sonuçlandırılmış.');
      const statements = [
        db().prepare("UPDATE access_requests SET status = 'rejected', decided_at = ?, decision_note = ? WHERE id = ?").bind(now, text(b.note, 1000), req.id),
        db().prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE ref_id = ?').bind(now, req.id),
      ];
      if (req.type === 'initial') statements.push(db().prepare("UPDATE members SET status = 'rejected' WHERE id = ? AND status = 'pending'").bind(req.member_id));
      await db().batch(statements);
      await activity(req.member_id, (req.type === 'initial' ? 'Başvuru reddedildi' : 'Ek program talebi reddedildi'), c.user.email);
      await audit(c, 'Firma talebi reddedildi', req.id);
      return json({ok: true});
    }

    // ---- Program yetkileri ve CV atama ----
    if (b.action === 'grant-save') {
      const member = await db().prepare('SELECT id FROM members WHERE id = ?').bind(String(b.memberId || '')).first();
      if (!member) throw new Error('Firma bulunamadı.');
      const items = await cleanItems([{programId: b.programId, areaId: b.areaId, quota: Number(b.quota)}]);
      await upsertGrants(String(b.memberId), items, null, now);
      await activity(String(b.memberId), 'Program yetkisi verildi: ' + (await describeItems(items)), c.user.email);
      await audit(c, 'Program yetkisi verildi', String(b.memberId));
      return json({ok: true});
    }
    if (b.action === 'grant-delete') {
      const grant: any = await db().prepare('SELECT * FROM member_grants WHERE id = ?').bind(String(b.id || '')).first();
      if (!grant) throw new Error('Yetki bulunamadı.');
      const res = await db().batch([
        db().prepare('DELETE FROM member_profiles WHERE grant_id = ?').bind(grant.id),
        db().prepare('DELETE FROM member_grants WHERE id = ?').bind(grant.id),
      ]);
      await activity(grant.member_id, 'Program yetkisi kaldırıldı (' + res[0].meta.changes + ' CV erişimi kapatıldı)', c.user.email);
      await audit(c, 'Program yetkisi kaldırıldı (' + res[0].meta.changes + ' CV erişimi kapatıldı)', grant.member_id);
      return json({ok: true, removed: res[0].meta.changes});
    }
    if (b.action === 'assign') {
      const member = await db().prepare('SELECT id FROM members WHERE id = ?').bind(String(b.memberId || '')).first();
      if (!member) throw new Error('Firma bulunamadı.');
      const ids = idList(b.profileIds);
      let grantId: string | null = null;
      if (b.grantId) {
        const grant: any = await db().prepare('SELECT id FROM member_grants WHERE id = ? AND member_id = ?').bind(String(b.grantId), b.memberId).first();
        if (!grant) throw new Error('Program yetkisi bulunamadı.');
        grantId = grant.id;
      }
      const ph = ids.map(() => '?').join(',');
      const ok = (await db().prepare("SELECT id FROM profiles WHERE status = 'published' AND evidence <> '' AND id IN (" + ph + ')').bind(...ids).all()).results.map((x: any) => x.id);
      if (ok.length !== ids.length) throw new Error('Yalnızca yayındaki (paylaşım dayanağı olan) mezunlar firmaya açılabilir.');
      const res = await db().batch(ids.map((id) => db().prepare('INSERT OR IGNORE INTO member_profiles (member_id, profile_id, grant_id, granted_at, granted_by) VALUES (?, ?, ?, ?, ?)').bind(b.memberId, id, grantId, now, c.user!.email)));
      const count = res.reduce((n, x) => n + x.meta.changes, 0);
      if (count) await activity(String(b.memberId), count + ' CV firmaya açıldı', c.user.email);
      await audit(c, 'Firmaya ' + count + ' CV açıldı', String(b.memberId));
      return json({ok: true, count});
    }
    if (b.action === 'unassign') {
      const ids = idList(b.profileIds);
      const res = await db().batch(ids.map((id) => db().prepare('DELETE FROM member_profiles WHERE member_id = ? AND profile_id = ?').bind(String(b.memberId || ''), id)));
      const count = res.reduce((n, x) => n + x.meta.changes, 0);
      if (count) await activity(String(b.memberId), count + ' CV erişimi kaldırıldı', c.user.email);
      await audit(c, 'Firmadan ' + count + ' CV erişimi kaldırıldı', String(b.memberId));
      return json({ok: true, count});
    }

    // ---- İşe alım ----
    if (b.action === 'hiring-decide') {
      const row: any = await db().prepare('SELECT * FROM placements WHERE id = ?').bind(String(b.id || '')).first();
      if (!row) throw new Error('Kayıt bulunamadı.');
      const payload = JSON.parse(row.payload);
      if (payload.stage !== PENDING_STAGE) throw new Error('Bu kayıt zaten sonuçlandırılmış.');
      if (b.approve) {
        const assigned = await db().prepare('SELECT 1 FROM member_profiles WHERE member_id = ? AND profile_id = ?').bind(row.member, row.candidate).first();
        if (!assigned) throw new Error('Onaylamadan önce mezunun CV’sini bu firmaya açın.');
        Object.assign(payload, {stage: stages[0], approved: true, approvedAt: now});
      } else {
        Object.assign(payload, {stage: REJECTED_STAGE, approved: false, rejectedAt: now});
      }
      await db().batch([
        db().prepare('UPDATE placements SET payload = ?, updated = ? WHERE id = ?').bind(JSON.stringify(payload), now, row.id),
        db().prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE ref_id = ?').bind(now, row.id),
      ]);
      const cand: any = await db().prepare('SELECT payload FROM profiles WHERE id = ?').bind(row.candidate).first();
      await activity(row.member, (b.approve ? 'İşe alım talebi onaylandı: ' : 'İşe alım talebi reddedildi: ') + (cand ? JSON.parse(cand.payload).name : 'aday'), c.user.email);
      await audit(c, b.approve ? 'İşe alım talebi onaylandı' : 'İşe alım talebi reddedildi', row.candidate);
      return json({ok: true});
    }
    if (b.action === 'placement') {
      if (!stages.includes(b.stage)) throw new Error('Aşama geçersiz.');
      const existing: any = b.id ? await db().prepare('SELECT * FROM placements WHERE id = ?').bind(String(b.id)).first() : null;
      const member = existing?.member || String(b.member || '');
      const candidate = existing?.candidate || String(b.candidate || '');
      if (!member) throw new Error('Firma seçin.');
      const p: any = await db().prepare("SELECT id FROM profiles WHERE id = ? AND status = 'published' AND evidence <> ''").bind(candidate).first();
      if (!p) throw new Error('Mezun yayında değil.');
      if (b.stage === 'İşe başladı' && !isDate(b.start)) throw new Error('İşe başlama tarihi gerekli.');
      if (b.confirmed3) {
        const start = new Date(b.start);
        start.setMonth(start.getMonth() + 3);
        if (!b.start || start > new Date()) throw new Error('Üç aylık devam teyidi için en az üç ay geçmelidir.');
      }
      const old = existing ? JSON.parse(existing.payload) : {};
      const payload = {...old, stage: b.stage, role: text(b.role), start: b.start || '', verified: !!b.verified, firstJob: !!b.firstJob, woman: !!b.woman, confirmed3: !!b.confirmed3, approved: true, approvedAt: old.approvedAt || now};
      await db().batch([
        db().prepare('INSERT OR IGNORE INTO member_profiles (member_id, profile_id, grant_id, granted_at, granted_by) VALUES (?, ?, NULL, ?, ?)').bind(member, candidate, now, c.user!.email),
        db().prepare('INSERT INTO placements (id, member, candidate, payload, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(member, candidate) DO UPDATE SET payload = excluded.payload, updated = excluded.updated').bind(existing?.id || crypto.randomUUID(), member, candidate, JSON.stringify(payload), now),
      ]);
      await audit(c, 'İşe alım aşaması güncellendi', candidate);
      return json({ok: true});
    }

    // ---- Program menüsü ----
    if (b.action === 'program-save') {
      const name = text(b.name);
      if (!name) throw new Error('Program adı gerekli.');
      const id = b.id || 'p-' + crypto.randomUUID();
      await db().prepare('INSERT INTO programs (id, name, sort, active) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, sort = excluded.sort, active = excluded.active').bind(id, name, Number(b.sort) || 0, b.active === false ? 0 : 1).run();
      await audit(c, 'Program kaydedildi: ' + name);
      return json({ok: true, id});
    }
    if (b.action === 'area-save') {
      const name = text(b.name);
      if (!name) throw new Error('Alan adı gerekli.');
      const program = await db().prepare('SELECT id FROM programs WHERE id = ?').bind(String(b.programId || '')).first();
      if (!program) throw new Error('Program bulunamadı.');
      const id = b.id || 'a-' + crypto.randomUUID();
      await db().prepare('INSERT INTO program_areas (id, program_id, name, sort, active) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, sort = excluded.sort, active = excluded.active').bind(id, b.programId, name, Number(b.sort) || 0, b.active === false ? 0 : 1).run();
      await audit(c, 'Program alanı kaydedildi: ' + name);
      return json({ok: true, id});
    }
    if (b.action === 'program-delete' || b.action === 'area-delete') {
      const id = String(b.id || '');
      const isProgram = b.action === 'program-delete';
      const used = await db().prepare(isProgram ? 'SELECT 1 FROM member_grants WHERE program_id = ? LIMIT 1' : 'SELECT 1 FROM member_grants WHERE area_id = ? LIMIT 1').bind(id).first();
      if (used) throw new Error('Bu kayıt firma yetkilerinde kullanılıyor. Silmek yerine pasife alın.');
      await db().batch(isProgram
        ? [db().prepare('DELETE FROM program_areas WHERE program_id = ?').bind(id), db().prepare('DELETE FROM programs WHERE id = ?').bind(id)]
        : [db().prepare('DELETE FROM program_areas WHERE id = ?').bind(id)]);
      await audit(c, isProgram ? 'Program silindi' : 'Program alanı silindi', id);
      return json({ok: true});
    }

    return json({error: 'İşlem bulunamadı.'}, 400);
  } catch (e: any) {
    return json({error: e.message?.includes('UNIQUE') ? 'Bu kayıt zaten mevcut.' : e.message || 'İşlem tamamlanamadı.'}, 400);
  }
}
