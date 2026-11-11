import {redirect} from 'next/navigation';
import {identity} from '../../lib/server';
import AdminApp from './admin-app';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Yönetim • GY Kariyer Ağı'};
// Yönetim paneli yalnızca admin rolüne sunucu tarafında açılır; firma kullanıcıları yönlendirilir.
export default async function Page() {
  const c = await identity();
  if (!c.user) redirect('/giris');
  if (!c.admin) redirect('/firma');
  return <AdminApp email={c.user.email} />;
}
