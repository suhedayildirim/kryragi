import {db, json, originOK, identity, audit, rateLimit} from '../../../../lib/server';
import {verifyPassword, hashPassword, passwordProblem} from '../../../../lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(r: Request) {
  try {
    if (!originOK(r)) return json({error: 'İstek kaynağı geçersiz.'}, 403);
    const c = await identity();
    if (!c.user) return json({error: 'Giriş yapmanız gerekiyor.'}, 401);
    if (!(await rateLimit('password:' + c.user.userId, 5, 15 * 60 * 1000))) return json({error: 'Çok fazla deneme. Daha sonra yeniden deneyin.'}, 429);
    const b: any = await r.json();
    const user: any = await db().prepare('SELECT password_hash FROM users WHERE id = ?').bind(c.user.userId).first();
    if (!user || !(await verifyPassword(String(b.current || ''), user.password_hash))) return json({error: 'Mevcut şifre hatalı.'}, 400);
    const problem = passwordProblem(b.next);
    if (problem) return json({error: problem}, 400);
    await db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(b.next), c.user.userId).run();
    await audit(c, 'Şifre değiştirildi');
    return json({ok: true});
  } catch {
    return json({error: 'Şifre değiştirilemedi.'}, 500);
  }
}
