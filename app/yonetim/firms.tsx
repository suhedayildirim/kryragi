'use client';
import {useState} from 'react';
import {Plus, Building2, Trash2, KeyRound, Mail, Phone, Globe, MapPin, Layers, PhoneCall, History, AlertTriangle} from 'lucide-react';
import {Button, Modal, Input, PageTitle, date, formatWorkModels} from '../components/ui';
import {memberStatus, assignedFor} from './requests';
import {itemLabel, needsFollowUp} from '../../lib/model';
import {FollowBadge, FirmTimeline} from './followup';
import type {AdminCtx} from './admin-app';

export function FirmsTab({ctx}: {ctx: AdminCtx}) {
  const {data} = ctx;
  const [edit, setEdit] = useState<any>(null);
  const [password, setPassword] = useState<any>(null);
  const count = (list: any[], id: string) => list.filter((x) => x.member_id === id).length;
  const today = new Date().toISOString().slice(0, 10);
  return <>
    <PageTitle title="Firmalar ve yetkiler" desc="Firma hesaplarını, erişim sürelerini, program yetkilerini ve firmaya açılan CV’leri yönetin." />
    <Button onClick={() => setEdit({email: '', password: '', name: '', company: '', title: '', phone: '', website: '', city: '', status: 'approved', expires: ''})}><Plus size={17} />Firma ekle</Button>
    <div className="tablewrap space"><table><thead><tr><th>Firma / yetkili</th><th>İletişim</th><th>Durum</th><th>Takip</th><th>Bitiş</th><th>Yetki</th><th>CV</th><th>İşlem</th></tr></thead><tbody>
      {data.members.map((m) => <tr key={m.id}>
        <td><button className="linkbtn" onClick={() => ctx.openFirm(m.id)}>{m.company}</button><small>{m.name}{m.title ? ' · ' + m.title : ''}</small></td>
        <td>{m.email}<small>{m.phone}</small></td>
        <td><span className={'status ' + (m.status === 'approved' && m.expires >= today ? 'published' : m.status === 'pending' ? 'pending' : 'hidden')}>{m.status === 'approved' && m.expires < today ? 'Süresi doldu' : memberStatus(m.status)}</span></td>
        <td>{m.status === 'approved' ? <FollowBadge status={m.follow_status} /> : <span className="muted">—</span>}</td>
        <td>{m.expires || '—'}</td>
        <td>{count(data.grants, m.id)}</td>
        <td>{count(data.assignments, m.id)}</td>
        <td className="actions">
          <button className="textbtn" onClick={() => ctx.openFirm(m.id)}>Detay</button>
          <button className="textbtn" onClick={() => ctx.openAccess(m.id)}>Yetkiler ve CV</button>
          <button className="textbtn" onClick={() => setEdit({...m})}>Düzenle</button>
          <button className="textbtn" onClick={() => setPassword({id: m.id, company: m.company, password: ''})}><KeyRound size={14} />Şifre</button>
        </td>
      </tr>)}
    </tbody></table></div>
    {!data.members.length && <div className="empty"><Building2 size={32} /><h3>Henüz firma yok</h3><p>QR bağlantısıyla gelen talepler veya elle eklediğiniz firmalar burada listelenir.</p></div>}
    <div className="note">Firma kullanıcıları yönetim paneline erişemez. Yalnızca kendilerine açtığınız program bilgilerini ve CV’leri görür.</div>

    {edit && <Modal title={edit.id ? 'Firmayı düzenle' : 'Firma ekle'} close={() => setEdit(null)}>
      <form onSubmit={async (e) => { e.preventDefault(); const d = await ctx.act({action: 'member-save', ...edit}); if (d) setEdit(null); }}>
        <Input label="Firma ünvanı" required value={edit.company} onChange={(e: any) => setEdit({...edit, company: e.target.value})} />
        <Input label="Yetkili ad-soyad" required value={edit.name} onChange={(e: any) => setEdit({...edit, name: e.target.value})} />
        <Input label="Unvan" value={edit.title || ''} onChange={(e: any) => setEdit({...edit, title: e.target.value})} />
        <Input label="Giriş e-postası" type="email" required disabled={!!edit.id} value={edit.email} onChange={(e: any) => setEdit({...edit, email: e.target.value})} />
        {!edit.id && <Input label="İlk şifre (en az 8 karakter, firmaya siz iletirsiniz)" type="text" required minLength={8} value={edit.password} onChange={(e: any) => setEdit({...edit, password: e.target.value})} />}
        <Input label="Telefon" value={edit.phone || ''} onChange={(e: any) => setEdit({...edit, phone: e.target.value})} />
        <Input label="Web sitesi" value={edit.website || ''} onChange={(e: any) => setEdit({...edit, website: e.target.value})} />
        <Input label="Şehir" value={edit.city || ''} onChange={(e: any) => setEdit({...edit, city: e.target.value})} />
        <label className="field">Durum<select value={edit.status} onChange={(e) => setEdit({...edit, status: e.target.value})}><option value="pending">Onay bekliyor</option><option value="approved">Onaylı</option><option value="suspended">Durduruldu</option><option value="rejected">Reddedildi</option></select></label>
        <Input label="Erişim bitiş tarihi" type="date" required={edit.status === 'approved'} value={edit.expires || ''} onChange={(e: any) => setEdit({...edit, expires: e.target.value})} />
        <div className="modalfoot">
          <Button disabled={ctx.busy}>Kaydet</Button>
          {edit.id && <button type="button" className="textbtn danger" onClick={async () => { if (confirm(edit.company + ' firmasının hesabı, yetkileri, CV erişimleri, talepleri ve işe alım kayıtları kalıcı olarak silinsin mi?')) { const d = await ctx.act({action: 'member-delete', id: edit.id}, 'Firma silindi.'); if (d) setEdit(null); } }}><Trash2 size={16} />Firmayı sil</button>}
        </div>
      </form>
    </Modal>}

    {password && <Modal title={'Şifre belirle — ' + password.company} close={() => setPassword(null)}>
      <form onSubmit={async (e) => { e.preventDefault(); const d = await ctx.act({action: 'member-password', id: password.id, password: password.password}, 'Yeni şifre kaydedildi. Firmaya güvenli bir kanaldan iletin.'); if (d) setPassword(null); }}>
        <p className="hint">E-posta altyapısı olmadığı için yeni şifreyi firmaya siz iletirsiniz. Firmanın açık oturumları kapatılır.</p>
        <Input label="Yeni şifre (en az 8 karakter)" type="text" required minLength={8} value={password.password} onChange={(e: any) => setPassword({...password, password: e.target.value})} />
        <div className="modalfoot"><Button disabled={ctx.busy}>Şifreyi kaydet</Button></div>
      </form>
    </Modal>}
  </>;
}

// Firma detay penceresi: iletişim bilgileri, yetkiler, açılan CV'ler, talepler ve işe alım kayıtları.
export function FirmDetailModal({ctx, memberId, close}: {ctx: AdminCtx; memberId: string; close: () => void}) {
  const {data} = ctx;
  const m = data.members.find((x) => x.id === memberId);
  if (!m) return null;
  const today = new Date().toISOString().slice(0, 10);
  const grants = data.grants.filter((g) => g.member_id === m.id);
  const cvIds = new Set(data.assignments.filter((a) => a.member_id === m.id).map((a) => a.profile_id));
  const cvs = data.profiles.filter((p) => cvIds.has(p.id));
  const requests = data.requests.filter((r) => r.member_id === m.id);
  const placements = data.placements.filter((p) => p.member === m.id);
  const status = m.status === 'approved' && m.expires < today ? 'Süresi doldu' : memberStatus(m.status);
  return (
    <Modal title={m.company} close={close} wide>
      {m.status === 'approved' && <div className="followbar">
        <span>Takip durumu: <FollowBadge status={m.follow_status} /></span>
        {m.next_follow_up && <span>Sonraki takip: <b>{new Date(m.next_follow_up + 'T12:00:00').toLocaleDateString('tr-TR')}</b></span>}
        {needsFollowUp(m, data.followupDays) && <span className="duetag"><AlertTriangle size={12} /> Takip gerekiyor</span>}
        <Button onClick={() => ctx.openFollowup(m.id)}><PhoneCall size={15} />İletişim kaydı ekle</Button>
      </div>}
      <div className="details">
        {[
          ['Yetkili', m.name],
          ['Unvan', m.title],
          ['E-posta', <a key="e" href={'mailto:' + m.email}><Mail size={13} /> {m.email}</a>],
          ['Telefon', m.phone ? <a key="p" href={'tel:' + m.phone}><Phone size={13} /> {m.phone}</a> : ''],
          ['Web sitesi', m.website ? <a key="w" href={m.website} target="_blank" rel="noreferrer"><Globe size={13} /> {m.website}</a> : ''],
          ['Şehir', m.city ? <span key="c"><MapPin size={13} /> {m.city}</span> : ''],
          ['Durum', status],
          ['Erişim bitişi', m.expires],
          ['Kayıt tarihi', m.created_at ? date(m.created_at) : ''],
          ['Kullanım koşulları', m.terms],
        ].map(([l, v]: any) => <div key={l}><small>{l}</small><b>{v || 'Belirtilmedi'}</b></div>)}
      </div>

      <h3 className="formsection"><Layers size={15} /> Program yetkileri</h3>
      {grants.length ? <div className="items">{grants.map((g) => { const l = itemLabel(data.catalog, g); return <div key={g.id}><span>{l.program} › <b>{l.area}</b></span><span className="quota-badge">Açılan {assignedFor(data, g)} / kontenjan {g.quota}</span></div>; })}</div> : <p className="muted">Henüz program yetkisi yok.</p>}

      <h3 className="formsection">Firmaya açık CV’ler ({cvs.length})</h3>
      {cvs.length ? <div className="tablewrap"><table><thead><tr><th>Mezun</th><th>Program / alan</th><th>İşe alım</th></tr></thead><tbody>
        {cvs.map((p) => { const pl = placements.find((x) => x.candidate === p.id); return <tr key={p.id}><td><b>{p.name}</b><small>{p.email}</small></td><td>{p.classGroup}<small>{p.program}</small></td><td>{pl ? pl.stage : '—'}</td></tr>; })}
      </tbody></table></div> : <p className="muted">Firmaya henüz CV açılmadı.</p>}

      <h3 className="formsection">Talepler ({requests.length})</h3>
      {requests.length ? <div className="tablewrap"><table><thead><tr><th>Tarih</th><th>Tür</th><th>Talep</th><th>Durum</th></tr></thead><tbody>
        {requests.map((r) => <tr key={r.id}><td>{date(r.created_at)}</td><td>{r.type === 'initial' ? 'Başvuru' : 'CV talebi'}</td><td>{r.items.map((i: any) => { const l = itemLabel(data.catalog, i); return <small key={i.programId + i.areaId}>{l.program} › {l.area} (kontenjan {i.quota})</small>; })}{r.other_label && <small>Diğer › {r.other_label} (kontenjan {r.other_quota})</small>}{!!r.work_models?.length && <small>Çalışma modeli: {formatWorkModels(r.work_models)}</small>}{r.note && <small>Not: {r.note}</small>}</td><td><span className={'status ' + (r.status === 'approved' ? 'published' : r.status === 'pending' ? 'pending' : 'hidden')}>{r.status === 'approved' ? 'Onaylandı' : r.status === 'pending' ? 'Bekliyor' : 'Reddedildi'}</span></td></tr>)}
      </tbody></table></div> : <p className="muted">Talep yok.</p>}

      <h3 className="formsection"><History size={15} /> Firma geçmişi</h3>
      <FirmTimeline ctx={ctx} memberId={m.id} />

      <div className="modalfoot">
        <Button onClick={() => ctx.openAccess(m.id)}>Yetkiler ve CV atama</Button>
      </div>
    </Modal>
  );
}
