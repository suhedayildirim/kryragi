import {redirect} from 'next/navigation';
import {identity, permitted} from '../../lib/server';
import CompanyApp from './company-app';
import RequestsPanel from './requests-panel';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Firma paneli • GY Kariyer Ağı'};

// Firma paneli: yönetici buraya yönlendirilir, firma yönetim paneline hiç erişemez.
export default async function Page() {
  const c = await identity();
  if (!c.user) redirect('/giris');
  if (c.admin) redirect('/yonetim');
  if (!c.member) redirect('/giris');
  if (permitted(c)) return <CompanyApp />;
  const m = c.member;
  return (
    <RequestsPanel
      initial={{
        member: {
          id: m.id,
          company: m.company,
          name: m.name,
          title: m.title || '',
          email: m.email,
          phone: m.phone || '',
          website: m.website || '',
          city: m.city || '',
          status: m.status,
        },
      }}
    />
  );
}
