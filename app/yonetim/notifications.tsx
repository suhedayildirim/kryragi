'use client';
import {useCallback, useEffect, useState} from 'react';
import {Bell, Check, RefreshCw, Mail, Phone, ArrowRight} from 'lucide-react';
import {date} from '../components/ui';
import type {AdminCtx} from './admin-app';

const types: Record<string, {label: string; tab: string}> = {
  access_request: {label: 'Yeni firma talebi', tab: 'requests'},
  program_request: {label: 'CV talebi', tab: 'requests'},
  hiring_request: {label: 'İşe alım talebi', tab: 'hiring'},
};

async function post(body: any) {
  const r = await fetch('/api/notifications', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error || 'İşlem tamamlanamadı.');
  return d;
}

// Okunmamış bildirim sayısı; 30 saniyede bir ve pencere odaklandığında yenilenir.
export function useNotificationSummary() {
  const [state, setState] = useState<{unread: number; total: number; error?: string}>({unread: 0, total: 0});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const r = await fetch('/api/notifications?summary=1');
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) setState(d);
      } catch (e: any) {
        if (active) setState((old) => ({...old, error: e.message}));
      }
    };
    update();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') update(); }, 30000);
    window.addEventListener('focus', update);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', update); };
  }, [tick]);
  return {...state, refresh};
}

export function NotificationBell({summary, onClick}: {summary: any; onClick: () => void}) {
  return <button className="textbtn contact-bell" onClick={onClick} aria-label={'Bildirimler, ' + (summary.unread || 0) + ' okunmamış'} title={summary.error || 'Yönetim bildirimleri'}><Bell size={18} /><span>Bildirimler</span>{summary.unread > 0 && <b className="contact-count">{summary.unread}</b>}</button>;
}

export function NotificationsTab({ctx, onChange}: {ctx: AdminCtx; onChange: () => void}) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<any>({notifications: [], total: 0, unread: 0});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const reload = () => setTick((n) => n + 1);
  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const r = await fetch('/api/notifications?offset=' + offset);
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) { setData(d); setError(''); }
      } catch (e: any) { if (active) setError(e.message); } finally { if (active) setLoading(false); }
    };
    update();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') update(); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [offset, tick]);
  async function mark(body: any) {
    try { await post({action: 'read', ...body}); reload(); onChange(); } catch (e: any) { setError(e.message); }
  }
  return <>
    <div className="sectiontitle"><div><h1>Bildirimler</h1><p>Firmalardan gelen talepler ve işe alım bildirimleri. E-posta gönderilmez; panel açıkken 30 saniyede bir yenilenir.</p></div><button className="btn secondary" onClick={() => { reload(); onChange(); }}><RefreshCw size={16} />Yenile</button></div>
    <div className="panel contact-summary"><span><b>{data.unread}</b> okunmamış</span><span><b>{data.total}</b> bildirim</span><button className="btn secondary" disabled={!data.unread} onClick={() => mark({all: true})}>Tümünü okundu işaretle</button></div>
    {error && <p className="alert error" role="alert">{error}</p>}
    {loading ? <div className="empty">Bildirimler yükleniyor…</div> : data.notifications.length ? <div className="notiflist">
      {data.notifications.map((n: any) => <article key={n.id} className={'panel notif' + (!n.read_at ? ' contact-unread' : '')}>
        <div className="reqhead"><div><span className={'pill ' + (!n.read_at ? 'contact-new' : '')}>{types[n.type]?.label || n.type}</span><h3>{n.title}</h3></div><small>{date(n.created_at)}</small></div>
        {n.body && <p className="notifbody">{n.body}</p>}
        <div className="contactgrid">
          {n.company && <span><button className="linkbtn" onClick={() => ctx.openFirm(n.member_id)}>{n.company}</button>{n.actor_name ? ' · ' + n.actor_name : ''}</span>}
          {n.actor_email && <a href={'mailto:' + n.actor_email}><Mail size={14} />{n.actor_email}</a>}
          {n.actor_phone && <a href={'tel:' + n.actor_phone}><Phone size={14} />{n.actor_phone}</a>}
        </div>
        <div className="toolbar">
          {types[n.type] && <button className="textbtn" onClick={() => { if (!n.read_at) mark({ids: [n.id]}); ctx.go(types[n.type].tab); }}>İncele <ArrowRight size={14} /></button>}
          {!n.read_at ? <button className="textbtn" onClick={() => mark({ids: [n.id]})}><Check size={14} />Okundu işaretle</button> : <span className="muted"><Check size={14} /> Okundu</span>}
        </div>
      </article>)}
    </div> : <div className="empty"><Bell size={30} /><h3>Henüz bildirim yok</h3><p>QR formundan talep geldiğinde veya firma bir öğrenciyi işe alım sürecine eklediğinde burada görünür.</p></div>}
    <div className="toolbar space"><button className="btn secondary" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Önceki</button><span>Sayfa {Math.floor(offset / 50) + 1}</span><button className="btn secondary" disabled={loading || !data.hasMore} onClick={() => setOffset(offset + 50)}>Sonraki</button></div>
  </>;
}
