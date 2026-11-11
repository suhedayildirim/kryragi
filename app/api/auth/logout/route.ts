import {json, originOK, destroySession, readCookie, SESSION_COOKIE, clearSessionCookie, isSecure} from '../../../../lib/server';
export const dynamic = 'force-dynamic';
export async function POST(r: Request) {
  if (!originOK(r)) return json({error: 'İstek kaynağı geçersiz.'}, 403);
  await destroySession(readCookie(r, SESSION_COOKIE));
  return json({ok: true}, 200, {'Set-Cookie': clearSessionCookie(isSecure(r))});
}
