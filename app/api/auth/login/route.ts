import {db, json, originOK, ensureAdmin, rateLimit, resetRate, clientIp, createSession, sessionCookie, isSecure} from '../../../../lib/server';
import {verifyPassword} from '../../../../lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(r: Request) {
  try {
    if (!originOK(r)) return json({error: 'İstek kaynağı geçersiz.'}, 403);
    await ensureAdmin();
    const b: any = await r.json();
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    const password = String(b.password || '').slice(0, 200);
    if (!email || !password) return json({error: 'E-posta ve şifre gereklidir.'}, 400);
    const key = 'login:' + clientIp(r) + ':' + email;
    if (!(await rateLimit(key, 5, 15 * 60 * 1000))) return json({error: 'Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin.'}, 429);
    const user: any = await db().prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) return json({error: 'E-posta veya şifre hatalı.'}, 401);
    await resetRate(key);
    const {token, expires} = await createSession(user.id);
    return json({ok: true, redirect: user.role === 'admin' ? '/yonetim' : '/firma'}, 200, {'Set-Cookie': sessionCookie(token, expires, isSecure(r))});
  } catch {
    return json({error: 'Giriş yapılamadı. Lütfen yeniden deneyin.'}, 500);
  }
}
