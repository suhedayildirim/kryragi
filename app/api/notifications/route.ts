import {db, identity, json, originOK} from '../../../lib/server';
export const dynamic = 'force-dynamic';
// Yönetim paneli bildirimleri (yeni talep, ek program talebi, işe alım talebi). E-posta gönderilmez.
export async function GET(r: Request) {
  try {
    const c = await identity();
    if (!c.admin) return json({error: 'Yönetici yetkisi gerekli.'}, 403);
    const counts: any = await db().prepare('SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END), 0) AS unread FROM notifications').first();
    const url = new URL(r.url);
    if (url.searchParams.has('summary')) return json(counts);
    const offset = Number(url.searchParams.get('offset') || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000) return json({error: 'Sayfa geçersiz.'}, 400);
    const result = await db().prepare('SELECT n.*, m.company, m.name AS actor_name, m.phone AS actor_phone FROM notifications n LEFT JOIN members m ON m.id = n.member_id ORDER BY n.created_at DESC, n.id DESC LIMIT 50 OFFSET ?').bind(offset).all();
    return json({...counts, offset, hasMore: offset + result.results.length < counts.total, notifications: result.results});
  } catch {
    return json({error: 'Bildirimler yüklenemedi. Yeniden deneyin.'}, 503);
  }
}
export async function POST(r: Request) {
  try {
    if (!originOK(r)) return json({error: 'İstek kaynağı geçersiz.'}, 403);
    const c = await identity();
    if (!c.admin) return json({error: 'Yönetici yetkisi gerekli.'}, 403);
    const b: any = await r.json();
    const now = new Date().toISOString();
    if (b.action !== 'read') return json({error: 'İşlem geçersiz.'}, 400);
    if (b.all === true) {
      await db().prepare('UPDATE notifications SET read_at = ? WHERE read_at IS NULL').bind(now).run();
      return json({ok: true});
    }
    if (!Array.isArray(b.ids) || !b.ids.length || b.ids.length > 50 || b.ids.some((id: any) => typeof id !== 'string' || id.length > 100)) return json({error: 'Bildirim seçimi geçersiz.'}, 400);
    await db().batch([...new Set<string>(b.ids)].map((id) => db().prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL').bind(now, id)));
    return json({ok: true});
  } catch {
    return json({error: 'Bildirim güncellenemedi.'}, 500);
  }
}
