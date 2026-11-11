import {redirect} from 'next/navigation';
import {identity} from '../lib/server';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const c = await identity();
  if (c.admin) redirect('/yonetim');
  if (c.member) redirect('/firma');
  redirect('/giris');
}
