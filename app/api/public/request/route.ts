import {db, json, originOK, rateLimit, clientIp, cleanItems, cleanOther, cleanWorkModels, describeItems, notify, activity} from '../../../../lib/server';
import {hashPassword, passwordProblem} from '../../../../lib/auth';
export const dynamic = 'force-dynamic';
const text = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
// QR bağlantısıyla açılan herkese açık firma talep formu.
export async function POST(r: Request) {
  try {
    if (!originOK(r)) return json({error: 'İstek kaynağı geçersiz.'}, 403);
    if (Number(r.headers.get('content-length') || 0) > 50000) return json({error: 'İstek çok büyük.'}, 413);
    const b: any = await r.json();
    if (b.website_confirm) return json({ok: true}); // bot tuzağı (gizli alan)
    if (!(await rateLimit('request:' + clientIp(r), 5, 60 * 60 * 1000))) return json({error: 'Çok fazla talep gönderildi. Lütfen daha sonra yeniden deneyin.'}, 429);
    const f = {company: text(b.company), name: text(b.name), title: text(b.title), email: text(b.email).toLowerCase(), phone: text(b.phone, 40), website: text(b.website), city: text(b.city, 100), note: text(b.note, 2000)};
    if (!f.company || !f.name) throw new Error('Firma ünvanı ve yetkili ad-soyad gereklidir.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) throw new Error('Geçerli bir e-posta adresi girin.');
    if (!/^[+0-9 ()-]{7,40}$/.test(f.phone)) throw new Error('Geçerli bir telefon numarası girin.');
    if (f.website && !/^https?:\/\/\S+$/i.test(f.website)) throw new Error('Web sitesi http:// veya https:// ile başlamalıdır.');
    const problem = passwordProblem(b.password);
    if (problem) throw new Error(problem);
    if (b.password !== b.password2) throw new Error('Şifreler eşleşmiyor.');
    if (b.terms !== true) throw new Error('Kullanım koşullarını ve KVKK aydınlatma metnini onaylayın.');
    const other = cleanOther(b.other);
    const items = await cleanItems(b.items, {allowEmpty: !!other});
    if (!items.length && !other) throw new Error('En az bir program / alan seçin veya diğer teknoloji alanı talebi oluşturun.');
    const workModels = cleanWorkModels(b.workModels);
    const exists = await db().prepare('SELECT id FROM users WHERE email = ? UNION SELECT id FROM members WHERE email = ?').bind(f.email, f.email).first();
    if (exists) return json({error: 'Bu e-posta ile daha önce başvuru yapılmış. Giriş yaparak panelinizden yeni program talep edebilirsiniz.'}, 409);
    const now = new Date().toISOString();
    const memberId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const summary = await describeItems(items, other, workModels);
    await db().batch([
      db().prepare('INSERT INTO members (id, email, uid, company, name, status, expires, terms, scopes, title, phone, website, city, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(memberId, f.email, f.company, f.name, 'pending', '', now + ' / Firma kullanım koşulları v1', '[]', f.title, f.phone, f.website, f.city, now),
      db().prepare('INSERT INTO users (id, email, password_hash, role, member_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), f.email, await hashPassword(b.password), 'company', memberId, now),
      db().prepare('INSERT INTO access_requests (id, member_id, type, items, note, status, created_at, other_label, other_quota, work_models) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(requestId, memberId, 'initial', JSON.stringify(items), f.note, 'pending', now, other?.label || '', other?.quota || 0, JSON.stringify(workModels)),
    ]);
    await notify({type: 'access_request', memberId, refId: requestId, actorEmail: f.email, title: f.company + ' mezun CV erişimi talep etti', body: f.name + (f.title ? ' · ' + f.title : '') + ' · ' + f.phone + '\n' + summary});
    await activity(memberId, 'QR formundan başvuru yapıldı:\n' + summary, f.email);
    return json({ok: true});
  } catch (e: any) {
    return json({error: e.message || 'Talep gönderilemedi.'}, 400);
  }
}
