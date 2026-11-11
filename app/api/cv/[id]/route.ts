import {db, bucket, identity, canSee, audit, json, originOK} from '../../../../lib/server';
export const dynamic = 'force-dynamic';
// CV indirme: admin veya CV'si kendisine açılmış onaylı firma.
export async function GET(r: Request, {params}: any) {
  const {id} = await params;
  const c = await identity();
  if (!c.user) return json({error: 'CV erişimi için giriş yapmanız gerekir.'}, 401);
  if (!c.admin && !(c.member && c.member.status === 'approved')) return json({error: 'CV erişimi için yetkili firma girişi gerekir.'}, 403);
  const p: any = await canSee(c, id);
  if (!p) return json({error: c.admin ? 'Mezun bulunamadı.' : 'CV erişime açık değil.'}, c.admin ? 404 : (c.member.expires < new Date().toISOString().slice(0, 10) || !c.member.terms ? 403 : 404));
  if (!p.cvkey) {
    const source = JSON.parse(p.payload).cvSource;
    if (!source) return json({error: 'CV dosyası veya bağlantısı henüz yüklenmedi.'}, 404);
    let url;
    try {
      url = new URL(source);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch {
      return json({error: 'CV bağlantısı geçersiz.'}, 400);
    }
    await audit(c, 'CV bağlantısı açıldı', id);
    return json({url: url.href});
  }
  const object = await bucket().get(p.cvkey);
  if (!object) return json({error: 'Dosya bulunamadı.'}, 404);
  await audit(c, 'CV indirildi', id);
  return new Response(object.body as any, {headers: {'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="GY-CV.pdf"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}});
}
export async function POST(r: Request, {params}: any) {
  try {
    const {id} = await params;
    const c = await identity();
    if (!originOK(r) || !c.admin) return json({error: 'Yönetici yetkisi gerekli.'}, 403);
    const p: any = await db().prepare('SELECT id, cvkey FROM profiles WHERE id = ?').bind(id).first();
    if (!p) return json({error: 'Mezun bulunamadı.'}, 404);
    if (Number(r.headers.get('content-length') || 0) > 10500000) return json({error: 'En fazla 10 MB.'}, 413);
    const f = (await r.formData()).get('file') as File;
    if (!f || f.size > 10 * 1024 * 1024) return json({error: 'PDF en fazla 10 MB olmalıdır.'}, 400);
    const buf = await f.arrayBuffer();
    if (new TextDecoder().decode(buf.slice(0, 5)) !== '%PDF-') return json({error: 'Geçerli PDF dosyası seçin.'}, 400);
    const key = 'cv/' + id + '/' + crypto.randomUUID() + '.pdf';
    await bucket().put(key, buf);
    await db().prepare('UPDATE profiles SET cvkey = ?, updated = ? WHERE id = ?').bind(key, new Date().toISOString(), id).run();
    if (p.cvkey) await bucket().delete(p.cvkey);
    await audit(c, 'CV yüklendi', id);
    return json({ok: true});
  } catch {
    return json({error: 'CV yüklenemedi.'}, 400);
  }
}
