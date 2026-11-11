'use client';
import {useState} from 'react';
import {Search, PhoneCall, AlertTriangle, Mail, Phone, Clock} from 'lucide-react';
import {Button, Modal, Input, PageTitle, date} from '../components/ui';
import {followStatuses, followChannels, followLabel, channelLabel, needsFollowUp} from '../../lib/model';
import {assignedFor} from './requests';
import type {AdminCtx} from './admin-app';

const todayStr = () => new Date().toISOString().slice(0, 10);
const dateOnly = (v?: string) => (v ? new Date(v + (v.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('tr-TR') : '—');

export function FollowBadge({status}: {status: string}) {
  return <span className={'follow ' + (status || 'bekliyor')}>{followLabel(status)}</span>;
}

export function lastActivity(ctx: AdminCtx, memberId: string) {
  return ctx.data.activities.find((a) => a.member_id === memberId);
}

// Onaylı firmalar: admin'in elle yaptığı iletişimin takibi.
export function FollowupTab({ctx}: {ctx: AdminCtx}) {
  const {data} = ctx;
  const [status, setStatus] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [query, setQuery] = useState('');
  const firms = data.members.filter((m) => m.status === 'approved');
  const due = (m: any) => needsFollowUp(m, data.followupDays);
  const list = firms
    .filter((m) => (!status || (m.follow_status || 'bekliyor') === status) && (!onlyDue || due(m)) && (!query || [m.company, m.name, m.email, m.phone].join(' ').toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))))
    .sort((a, b) => Number(due(b)) - Number(due(a)) || String(a.next_follow_up || '9999').localeCompare(String(b.next_follow_up || '9999')) || a.company.localeCompare(b.company, 'tr'));
  const cards: [string, string, number, () => void][] = [
    ['Takip gerekiyor', 'due', firms.filter(due).length, () => { setOnlyDue(true); setStatus(''); }],
    ...followStatuses.map(([k, l]) => [l, k, firms.filter((m) => (m.follow_status || 'bekliyor') === k).length, () => { setStatus(k); setOnlyDue(false); }] as [string, string, number, () => void]),
  ];
  return <>
    <PageTitle title="Firma takibi" desc="Onaylı firmalarla yürüttüğünüz iletişimi kaydedin. Hiç işlem yapılmayan firmalar “Bekliyor” durumunda kalır." />
    <div className="followcards">
      {cards.map(([label, key, n, onClick]) => <button key={key} className={'followcard ' + key + ((key === 'due' ? onlyDue : status === key) ? ' on' : '')} onClick={onClick}>
        <b>{n}</b><span>{key === 'due' && <AlertTriangle size={13} />}{label}</span>
      </button>)}
    </div>
    <p className="hint">“Takip gerekiyor”: sonraki takip tarihi gelen ya da onaylandıktan sonra {data.followupDays} günden uzun süredir hiç işlem yapılmamış firmalar.</p>
    <div className="filters">
      <label className="searchmini"><Search size={15} /><input placeholder="Firma, yetkili, e-posta…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <select aria-label="Takip durumu" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tüm durumlar</option>{followStatuses.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <label className="check"><input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} />Yalnızca takip gerekenler</label>
      <button className="textbtn" onClick={() => { setStatus(''); setOnlyDue(false); setQuery(''); }}>Sıfırla</button>
    </div>
    <div className="tablewrap"><table><thead><tr><th>Firma</th><th>İletişim</th><th>Takip durumu</th><th>Son işlem</th><th>Sonraki takip</th><th>CV / kontenjan</th><th>İşe alım</th><th>İşlem</th></tr></thead><tbody>
      {list.map((m) => {
        const last = lastActivity(ctx, m.id);
        const grants = data.grants.filter((g) => g.member_id === m.id);
        const opened = data.assignments.filter((a) => a.member_id === m.id).length;
        const quota = grants.reduce((n, g) => n + g.quota, 0);
        const hires = data.placements.filter((p) => p.member === m.id).length;
        const isDue = due(m);
        return <tr key={m.id} className={isDue ? 'duerow' : ''}>
          <td><button className="linkbtn" onClick={() => ctx.openFirm(m.id)}>{m.company}</button><small>{m.name}</small>{isDue && <small className="duetag"><AlertTriangle size={11} /> Takip gerekiyor</small>}</td>
          <td><a href={'mailto:' + m.email}><Mail size={12} /> {m.email}</a>{m.phone && <small><a href={'tel:' + m.phone}><Phone size={11} /> {m.phone}</a></small>}</td>
          <td><FollowBadge status={m.follow_status} /></td>
          <td>{last ? <>{date(last.created_at)}<small>{last.kind === 'contact' ? followLabel(last.status) + (last.channel ? ' · ' + channelLabel(last.channel) : '') : last.note.split('\n')[0]}</small><small>{last.created_by}</small></> : <span className="muted">—</span>}</td>
          <td>{m.next_follow_up ? <span className={m.next_follow_up <= todayStr() ? 'contact-error' : ''}><Clock size={12} /> {dateOnly(m.next_follow_up)}</span> : <span className="muted">—</span>}</td>
          <td><b>{opened}</b> / {quota || '—'}{grants.length > 0 && <small>{grants.filter((g) => assignedFor(data, g) < g.quota).length} yetkide eksik</small>}</td>
          <td>{hires}</td>
          <td className="actions">
            <button className="textbtn" onClick={() => ctx.openFollowup(m.id, 'iletisime_gecildi')}><PhoneCall size={14} />İletişime geçildi</button>
            <button className="textbtn" onClick={() => ctx.openFollowup(m.id)}>Durumu değiştir</button>
          </td>
        </tr>;
      })}
    </tbody></table></div>
    {!list.length && <div className="empty">{firms.length ? 'Filtreye uyan firma yok.' : 'Henüz onaylı firma yok. Talepleri onayladığınızda firmalar burada “Bekliyor” olarak görünür.'}</div>}
  </>;
}

// İletişim kaydı / durum değişikliği penceresi.
export function FollowupModal({ctx, memberId, status, close}: {ctx: AdminCtx; memberId: string; status?: string; close: () => void}) {
  const m = ctx.data.members.find((x) => x.id === memberId);
  const [f, setF] = useState({status: status || (m?.follow_status === 'bekliyor' ? 'iletisime_gecildi' : m?.follow_status) || 'iletisime_gecildi', channel: 'telefon', note: '', contactedAt: todayStr(), nextFollowUp: ''});
  if (!m) return null;
  return (
    <Modal title={'İletişim kaydı — ' + m.company} close={close}>
      <form onSubmit={async (e) => { e.preventDefault(); const d = await ctx.act({action: 'followup-save', id: m.id, ...f}, 'Takip kaydı eklendi.'); if (d) close(); }}>
        <p className="hint">Mevcut durum: <FollowBadge status={m.follow_status} /> · {m.name} · {m.email}{m.phone ? ' · ' + m.phone : ''}</p>
        <label className="field">Takip durumu<select value={f.status} onChange={(e) => setF({...f, status: e.target.value})}>{followStatuses.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field">İletişim kanalı<select value={f.channel} onChange={(e) => setF({...f, channel: e.target.value})}><option value="">Belirtilmedi</option>{followChannels.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <Input label="İletişim tarihi" type="date" max={todayStr()} required value={f.contactedAt} onChange={(e: any) => setF({...f, contactedAt: e.target.value})} />
        <label className="field">Not<textarea rows={3} maxLength={2000} placeholder="Görüşmenin özeti, firmanın ihtiyacı, sonraki adım…" value={f.note} onChange={(e) => setF({...f, note: e.target.value})} /></label>
        <Input label="Sonraki takip tarihi (isteğe bağlı)" type="date" value={f.nextFollowUp} onChange={(e: any) => setF({...f, nextFollowUp: e.target.value})} />
        <p className="hint">Sonraki takip tarihi geldiğinde firma “Takip gerekiyor” listesine düşer. Boş bırakırsanız mevcut hatırlatma kaldırılır.</p>
        <div className="modalfoot"><Button disabled={ctx.busy}>Kaydet</Button></div>
      </form>
    </Modal>
  );
}

// Firma geçmişi: admin iletişim kayıtları ve sistem olayları.
export function FirmTimeline({ctx, memberId}: {ctx: AdminCtx; memberId: string}) {
  const items = ctx.data.activities.filter((a) => a.member_id === memberId);
  if (!items.length) return <p className="muted">Henüz kayıt yok.</p>;
  return (
    <ol className="timeline">
      {items.map((a) => <li key={a.id} className={a.kind}>
        <div className="tlhead">
          {a.kind === 'contact' ? <><FollowBadge status={a.status} />{a.channel && <span className="pill">{channelLabel(a.channel)}</span>}<span>İletişim: {dateOnly(a.contacted_at)}</span></> : <span className="pill">Sistem</span>}
          <small>{date(a.created_at)} · {a.created_by}</small>
        </div>
        {a.note && <p>{a.note}</p>}
        {a.next_follow_up && <small><Clock size={11} /> Sonraki takip: {dateOnly(a.next_follow_up)}</small>}
      </li>)}
    </ol>
  );
}
