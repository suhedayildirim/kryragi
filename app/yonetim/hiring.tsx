'use client';
import {useState} from 'react';
import {Check, X, Mail, Plus} from 'lucide-react';
import {Button, Modal, Input, PageTitle, date} from '../components/ui';
import {stages, PENDING_STAGE, REJECTED_STAGE} from '../../lib/model';
import type {AdminCtx} from './admin-app';

export function HiringTab({ctx}: {ctx: AdminCtx}) {
  const {data} = ctx;
  const [edit, setEdit] = useState<any>(null);
  const profile = (id: string) => data.profiles.find((p) => p.id === id);
  const member = (id: string) => data.members.find((m) => m.id === id);
  const isAssigned = (p: any) => data.assignments.some((a) => a.member_id === p.member && a.profile_id === p.candidate);
  const pending = data.placements.filter((p) => p.stage === PENDING_STAGE);
  const rejected = data.placements.filter((p) => p.stage === REJECTED_STAGE);
  const active = data.placements.filter((p) => stages.includes(p.stage));
  return <>
    <PageTitle title="İşe alım süreçleri" desc="Firmaların “İşe alım sürecine ekle” talepleri burada onayınıza düşer. Onaylanan kayıtlarda öğrencinin e-postası firmaya açılır." />
    <div className="sectiontitle"><h2>Onay bekleyen işe alım talepleri</h2><span className="pill">{pending.length}</span></div>
    {pending.length ? <div className="tablewrap"><table><thead><tr><th>Firma / talep eden</th><th>Öğrenci</th><th>Pozisyon</th><th>Talep tarihi</th><th>İşlem</th></tr></thead><tbody>
      {pending.map((p) => { const g = profile(p.candidate); const m = member(p.member); return <tr key={p.id}>
        <td>{m ? <button className="linkbtn" onClick={() => ctx.openFirm(m.id)}>{m.company}</button> : <b>—</b>}<small><a href={'mailto:' + (p.requestedBy || m?.email)}><Mail size={12} /> {p.requestedBy || m?.email}</a></small>{m?.phone && <small>{m.phone}</small>}</td>
        <td><b>{g?.name || 'Silinmiş kayıt'}</b><small>{g?.program}{g?.classGroup ? ' › ' + g.classGroup : ''}</small><small>{g?.email}</small></td>
        <td>{p.role || '—'}</td>
        <td>{date(p.requestedAt || p.updated)}</td>
        <td className="actions">
          {!isAssigned(p) && <small className="contact-error">CV bu firmaya açık değil</small>}
          <button className="textbtn" disabled={ctx.busy || !isAssigned(p)} onClick={() => ctx.act({action: 'hiring-decide', id: p.id, approve: true}, 'İşe alım talebi onaylandı. Öğrencinin e-postası firmaya açıldı.')}><Check size={14} />Onayla</button>
          <button className="textbtn danger" disabled={ctx.busy} onClick={() => { if (confirm('İşe alım talebi reddedilsin mi?')) ctx.act({action: 'hiring-decide', id: p.id, approve: false}, 'Talep reddedildi.'); }}><X size={14} />Reddet</button>
        </td>
      </tr>; })}
    </tbody></table></div> : <div className="empty">Onay bekleyen işe alım talebi yok.</div>}

    <div className="sectiontitle"><h2>Aktif süreçler</h2><Button secondary onClick={() => setEdit({candidate: '', member: '', stage: stages[0], role: '', start: ''})}><Plus size={15} />Süreç ekle</Button></div>
    <div className="pipeline">{stages.map((stage) => <section key={stage}>
      <h3>{stage}<span>{active.filter((p) => p.stage === stage).length}</span></h3>
      {active.filter((p) => p.stage === stage).map((p) => <button className="processcard" key={p.id} onClick={() => setEdit({...p})}><b>{profile(p.candidate)?.name || 'Mezun'}</b><small>{member(p.member)?.company} · {p.role || 'Pozisyon belirtilmedi'}</small><span>{p.verified ? 'Admin teyitli' : 'Teyit bekliyor'}</span></button>)}
      <p className="placeholder">{active.some((p) => p.stage === stage) ? '' : 'Bu aşamada kayıt yok'}</p>
    </section>)}</div>
    {rejected.length > 0 && <p className="hint">Reddedilen işe alım talebi: {rejected.length}</p>}

    {edit && <Modal title="İşe alım kaydı" close={() => setEdit(null)}>
      <form onSubmit={async (e) => { e.preventDefault(); const d = await ctx.act({action: 'placement', ...edit}); if (d) setEdit(null); }}>
        {!edit.id && <>
          <label className="field">Firma<select required value={edit.member} onChange={(e) => setEdit({...edit, member: e.target.value})}><option value="">Firma seçin</option>{data.members.filter((m) => m.status === 'approved').map((m) => <option key={m.id} value={m.id}>{m.company}</option>)}</select></label>
          <label className="field">Mezun<select required value={edit.candidate} onChange={(e) => setEdit({...edit, candidate: e.target.value})}><option value="">Mezun seçin</option>{data.profiles.filter((p) => p.status === 'published' && p.evidence).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.classGroup}</option>)}</select></label>
          <p className="hint">Yönetici tarafından eklenen süreç doğrudan onaylıdır; mezunun CV’si firmaya açılır.</p>
        </>}
        {edit.id && <p><b>{profile(edit.candidate)?.name}</b> · {member(edit.member)?.company}</p>}
        <Input label="Pozisyon" value={edit.role || ''} onChange={(e: any) => setEdit({...edit, role: e.target.value})} />
        <label className="field">Aşama<select value={edit.stage} onChange={(e) => setEdit({...edit, stage: e.target.value})}>{stages.map((s) => <option key={s}>{s}</option>)}</select></label>
        <Input label="İşe başlama tarihi" type="date" value={edit.start || ''} onChange={(e: any) => setEdit({...edit, start: e.target.value})} />
        {[['firstJob', 'Mezunun ilk profesyonel işi'], ['woman', 'Kadın teknoloji istihdamı (beyan)'], ['verified', 'İşe başlama bilgisi firma ve mezundan teyit edildi'], ['confirmed3', 'En az üç aylık devamlılık teyit edildi']].map(([k, l]) => <label className="check" key={k}><input type="checkbox" checked={!!edit[k]} onChange={(e) => setEdit({...edit, [k]: e.target.checked})} />{l}</label>)}
        <div className="modalfoot"><Button disabled={ctx.busy}>Süreci kaydet</Button></div>
      </form>
    </Modal>}
  </>;
}
