import {redirect} from 'next/navigation';
import {identity} from '../../lib/server';
import LoginForm from './login-form';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Giriş • GY Kariyer Ağı'};
export default async function Page() {
  const c = await identity();
  if (c.admin) redirect('/yonetim');
  if (c.member) redirect('/firma');
  return <LoginForm />;
}
