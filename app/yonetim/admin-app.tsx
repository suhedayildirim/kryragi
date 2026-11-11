'use client';
import {useCallback, useEffect, useState} from 'react';
import {Inbox, ClipboardList, Bell, Briefcase, Trophy, GraduationCap, Upload, Building2, Layers, ShieldCheck, Eye, QrCode, BookOpen, UserCog} from 'lucide-react';
import {Shell, Feedback, useApi, PasswordForm, PageTitle, type Tab} from '../components/ui';
import {RequestsTab, AccessModal} from './requests';
import {FirmsTab, FirmDetailModal} from './firms';
import {FollowupTab, FollowupModal} from './followup';
import {GraduatesTab} from './graduates';
import {ImportTab} from './import';
import {ProgramsTab} from './programs';
import {HiringTab} from './hiring';
import {NotificationsTab, useNotificationSummary, NotificationBell} from './notifications';
import {PrivacyTab, BrandingTab, AwardsTab, AnalysisTab, QrModal} from './misc';
import {PENDING_STAGE, needsFollowUp} from '../../lib/model';

export type AdminData = {
  appUrl: string; profiles: any[]; members: any[]; requests: any[]; grants: any[]; assignments: any[]; placements: any[]; events: any[]; activities: any[]; followupDays: number; catalog: any[];
};
export type AdminCtx = {
  data: AdminData;
  busy: boolean;
  act: (body: any, success?: string) => Promise<any>;
  refresh: () => Promise<void>;
  setError: (s: string) => void;
  setNotice: (s: string) => void;
  go: (tab: string) => void;
  openAccess: (memberId: string, grantId?: string) => void;
  openFirm: (memberId: string) => void;
  openFollowup: (memberId: string, status?: string) => void;
};

const emptyData: AdminData = {appUrl: '', profiles: [], members: [], requests: [], grants: [], assignments: [], placements: [], events: [], activities: [], followupDays: 7, catalog: []};

export default function AdminApp({email}: {email: string}) {
  const [data, setData] = useState<AdminData>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('requests');
  const [qr, setQr] = useState(false);
  const [access, setAccess] = useState<{memberId: string; grantId?: string} | null>(null);
  const [firm, setFirm] = useState<string | null>(null);
  const [followup, setFollowup] = useState<{memberId: string; status?: string} | null>(null);
  const api = useApi('/api/admin');
  const summary = useNotificationSummary();

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/admin');
      if (r.status === 401 || r.status === 403) { window.location.assign('/giris'); return; }
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e: any) {
      api.setError(e.message || 'Veri yüklenemedi.');
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function act(body: any, success = 'İşlem kaydedildi.') {
    const d = await api.call(body, success);
    if (d) { await refresh(); summary.refresh(); }
    return d;
  }

  const ctx: AdminCtx = {data, busy: api.busy, act, refresh, setError: api.setError, setNotice: api.setNotice, go: setTab, openAccess: (memberId, grantId) => { setFirm(null); setAccess({memberId, grantId}); }, openFirm: (memberId) => setFirm(memberId), openFollowup: (memberId, status) => setFollowup({memberId, status})};
  const pendingRequests = data.requests.filter((x) => x.status === 'pending').length;
  const pendingHiring = data.placements.filter((x) => x.stage === PENDING_STAGE).length;
  const tabs: Tab[] = [
    {key: 'requests', label: 'Firma talepleri', icon: Inbox, group: 'ÇALIŞMA ALANI', badge: pendingRequests},
    {key: 'followup', label: 'Firma takibi', icon: ClipboardList, group: 'ÇALIŞMA ALANI', badge: data.members.filter((m) => needsFollowUp(m, data.followupDays)).length},
    {key: 'hiring', label: 'İşe alım süreçleri', icon: Briefcase, group: 'ÇALIŞMA ALANI', badge: pendingHiring},
    {key: 'notifications', label: 'Bildirimler', icon: Bell, group: 'ÇALIŞMA ALANI', badge: summary.unread},
    {key: 'awards', label: 'Etki ve ödüller', icon: Trophy, group: 'ÇALIŞMA ALANI'},
    {key: 'graduates', label: 'Mezun yönetimi', icon: GraduationCap, group: 'YÖNETİM'},
    {key: 'import', label: 'Toplu yükleme', icon: Upload, group: 'YÖNETİM'},
    {key: 'firms', label: 'Firmalar ve yetkiler', icon: Building2, group: 'YÖNETİM'},
    {key: 'programs', label: 'Programlar ve alanlar', icon: Layers, group: 'YÖNETİM'},
    {key: 'privacy', label: 'Veri ve erişim', icon: ShieldCheck, group: 'YÖNETİM'},
    {key: 'branding', label: 'Logo yönetimi', icon: Eye, group: 'YÖNETİM'},
    {key: 'account', label: 'Hesabım', icon: UserCog, group: 'HESAP'},
    {key: 'analysis', label: 'Ürün analizi', icon: BookOpen, group: 'HESAP'},
  ];

  return (
    <Shell
      tabs={tabs}
      tab={tab}
      onTab={setTab}
      account={{title: 'Akademi yönetimi', sub: email, initials: 'GY'}}
      actions={<>
        <NotificationBell summary={summary} onClick={() => setTab('notifications')} />
        <button className="textbtn" onClick={() => setQr(true)}><QrCode size={17} />Talep QR’ı</button>
      </>}
    >
      <Feedback error={api.error} setError={api.setError} notice={api.notice} />
      <main className="content">
        {!loaded ? <div className="empty">Yükleniyor…</div> : <>
          {tab === 'requests' && <RequestsTab ctx={ctx} />}
          {tab === 'followup' && <FollowupTab ctx={ctx} />}
          {tab === 'hiring' && <HiringTab ctx={ctx} />}
          {tab === 'notifications' && <NotificationsTab ctx={ctx} onChange={summary.refresh} />}
          {tab === 'awards' && <AwardsTab placements={data.placements} />}
          {tab === 'graduates' && <GraduatesTab ctx={ctx} />}
          {tab === 'import' && <ImportTab ctx={ctx} />}
          {tab === 'firms' && <FirmsTab ctx={ctx} />}
          {tab === 'programs' && <ProgramsTab ctx={ctx} />}
          {tab === 'privacy' && <PrivacyTab events={data.events} />}
          {tab === 'branding' && <BrandingTab ctx={ctx} />}
          {tab === 'account' && <><PageTitle title="Hesabım" desc="Yönetici hesabınızın şifresini buradan değiştirebilirsiniz." /><PasswordForm /></>}
          {tab === 'analysis' && <AnalysisTab />}
        </>}
      </main>
      {qr && <QrModal appUrl={data.appUrl} close={() => setQr(false)} />}
      {firm && <FirmDetailModal ctx={ctx} memberId={firm} close={() => setFirm(null)} />}
      {followup && <FollowupModal key={followup.memberId + (followup.status || '')} ctx={ctx} memberId={followup.memberId} status={followup.status} close={() => setFollowup(null)} />}
      {access && <AccessModal ctx={ctx} memberId={access.memberId} grantId={access.grantId} close={() => setAccess(null)} />}
    </Shell>
  );
}
