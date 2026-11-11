import {redirect} from 'next/navigation';
import {identity} from '../../lib/server';
export const dynamic = 'force-dynamic';
export default async function Layout({children}: {children: React.ReactNode}) {
  const c = await identity();
  if (!c.user) redirect('/giris');
  if (!c.admin) redirect('/firma');
  return children;
}
