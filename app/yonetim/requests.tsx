'use client';
import {useMemo, useState} from 'react';
import {Check, X, Mail, Phone, Globe, MapPin, UserCheck, FileText, Plus, Trash2, Search} from 'lucide-react';
import {Button, Modal, Input, PageTitle, itemLabel, formatWorkModels, date} from '../components/ui';
import {matchesGrant, normalize} from '../../lib/model';
import type {AdminCtx, AdminData} from './admin-app';

const statusText: Record<string, string> = {pending: 'Bekliyor', approved: 'Onaylı', suspended: 'Durduruldu', rejected: 'Reddedildi'};
export const memberStatus = (s: string) => statusText[s] || s;

// Bir yetki (program/alan) için firmaya açılmış CV sayısı.
export function assignedFor(data: AdminData, grant: any) {
  const {program, area} = itemLabel(data.catalog, grant);
  const ids = new Set(data.assignments.filter((a) => a.member_id === grant.member_id).map((a) => a.profile_id));
  return data.profiles.filter((p) => ids.has(p.id) && matchesGrant(p, program, grant.area_id ? area : '')).length;
}

const oneYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };

export function ContactInfo({m}: {m: any}) {
  return (
    <div className="contactgrid">
      <span><UserCheck size={14} />{m.name}{m.title ? ' · ' + m.title : ''}</span>
      <a href={'mailto:' + m.email}><Mail size={14} />{m.email}</a>
      {m.phone && <a href={'tel:' + m.phone}><Phone size={14} />{m.phone}</a>}
      {m.website && <a href={m.website} target="_blank" rel="noreferrer"><Globe size={14} />{m.website}</a>}
      {m.city && <span><MapPin size={14} />{m.city}</span>}
    </div>
  );
}

export function RequestsTab({ctx}: {ctx: AdminCtx}) {
  const {data} = ctx;
  const [approve, setApprove] = useState<any>(null);
  const member = (id: string) => data.members.find((m) => m.id === id);
  const pending = data.requests.filter((r) => r.status === 'pending');
  const decided = data.requests.filter((r) => r.status !== 'pending').slice(0, 50);
  // Onaylı yetkiler içinde kontenjanı dolmamış olanlar: CV ataması bekliyor.
  const waiting = data.grants
    .map((g) => ({...g, member: member(g.member_id), assigned: assignedFor(data, g)}))
    .filter((g) => g.member && g.member.status === 'approved' && g.assigned < g.quota);

  async function reject(r: any) {
    const note = window.prompt('Red gerekçesi (isteğe bağlı, firma panelinde görünmez):', '');
    if (note === null) return;
    await ctx.act({action: 'request-reject', id: r.id, note}, 'Talep reddedildi.');
  }

  return <>
    <PageTitle title="Firma talepleri" desc="QR formundan ve firma panelinden gelen mezun CV talepleri. Onayladığınız program yetkileri için CV ataması yapın." />
    <div className="sectiontitle"><h2>Onay bekleyen talepler</h2><span className="pill">{pending.length} talep</span></div>
    {!pending.length && <div className="empty">Bekleyen talep yok. Yeni talepler burada ve bildirimlerde görünür.</div>}
    <div className="reqlist">
      {pending.map((r) => {
        const m = member(r.member_id);
        if (!m) return null;
        return (
          <article key={r.id} className="panel reqcard">
            <div className="reqhead">
              <div><h3><button className="linkbtn" onClick={() => ctx.openFirm(m.id)}>{m.company}</button></h3><small>{date(r.created_at)}</small></div>
              <span className={'pill ' + (r.type === 'initial' ? 'contact-new' : '')}>{r.type === 'initial' ? 'Yeni firma başvurusu' : 'CV talebi'}</span>
            </div>
            <ContactInfo m={m} />
            <div className="items">
              {r.items.map((i: any) => { const l = itemLabel(data.catalog, i); return <div key={i.programId + i.areaId}><span>{l.program} › <b>{l.area}</b></span><span className="quota-badge">Kontenjan: {i.quota}</span></div>; })}
              {r.other_label && <div><span>Diğer › <b>{r.other_label}</b></span><span className="quota-badge">Kontenjan: {r.other_quota}</span></div>}
            </div>
            {!!r.work_models?.length && <p className="hint" style={{marginTop: 8}}>Tercih Edilen Çalışma Modeli: <b>{formatWorkModels(r.work_models)}</b></p>}
            {r.note && <p className="reqnote"><FileText size={14} />{r.note}</p>}
            <div className="toolbar">
              <Button disabled={ctx.busy} onClick={() => setApprove(r)}><Check size={16} />Onayla ve yetki ver</Button>
              <Button secondary disabled={ctx.busy} onClick={() => reject(r)}><X size={16} />Reddet</Button>
            </div>
          </article>
        );
      })}
    </div>

    <div className="sectiontitle"><div><h2>CV ataması bekleyen yetkiler</h2><p>Program yetkisi verilen ancak kontenjan kadar CV açılmamış firmalar.</p></div><span className="pill">{waiting.length} yetki</span></div>
    {waiting.length ? <div className="tablewrap"><table><thead><tr><th>Firma</th><th>Program › Alan</th><th>Açılan / kontenjan</th><th>İşlem</th></tr></thead><tbody>
      {waiting.map((g) => { const l = itemLabel(data.catalog, g); return <tr key={g.id}><td><button className="linkbtn" onClick={() => ctx.openFirm(g.member_id)}>{g.member.company}</button><small>{g.member.email}</small></td><td>{l.program}<small>{l.area}</small></td><td><b>{g.assigned}</b> / {g.quota}</td><td><button className="textbtn" onClick={() => ctx.openAccess(g.member_id, g.id)}>CV ata</button></td></tr>; })}
    </tbody></table></div> : <div className="empty">Tüm yetkilerde kontenjan kadar CV açılmış.</div>}

    {decided.length > 0 && <>
      <div className="sectiontitle"><h2>Sonuçlanan talepler</h2><span className="muted">Son 50</span></div>
      <div className="tablewrap"><table><thead><tr><th>Firma</th><th>Tür</th><th>Talep</th><th>Durum</th><th>Tarih</th></tr></thead><tbody>
        {decided.map((r) => { const m = member(r.member_id); return <tr key={r.id}><td>{m ? <button className="linkbtn" onClick={() => ctx.openFirm(m.id)}>{m.company}</button> : <b>Silinmiş firma</b>}<small>{m?.email}</small></td><td>{r.type === 'initial' ? 'Başvuru' : 'CV talebi'}</td><td>{r.items.map((i: any) => { const l = itemLabel(data.catalog, i); return <small key={i.programId + i.areaId}>{l.program} › {l.area} ({i.quota})</small>; })}{r.other_label && <small>Diğer › {r.other_label} ({r.other_quota})</small>}{!!r.work_models?.length && <small>Çalışma modeli: {formatWorkModels(r.work_models)}</small>}</td><td><span className={'status ' + (r.status === 'approved' ? 'published' : 'hidden')}>{r.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}</span></td><td>{date(r.decided_at)}</td></tr>; })}
      </tbody></table></div>
    </>}
    {approve && <ApproveModal ctx={ctx} request={approve} close={() => setApprove(null)} />}
  </>;
}

function ApproveModal({ctx, request, close}: {ctx: AdminCtx; request: any; close: () => void}) {
  const {data} = ctx;
  const m = data.members.find((x) => x.id === request.member_id);
  const [items, setItems] = useState(request.items.map((i: any) => ({...i, on: true})));
  const [expires, setExpires] = useState(m?.expires && m.expires >= new Date().toISOString().slice(0, 10) ? m.expires : oneYear());
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = items.filter((i: any) => i.on).map(({on, ...i}: any) => i);
    if (!chosen.length && !request.other_label) { setError('En az bir alan seçin ya da talebi reddedin.'); return; }
    const d = await ctx.act({action: 'request-approve', id: request.id, items: chosen, expires}, 'Talep onaylandı. Şimdi CV ataması yapabilirsiniz.');
    if (d) { close(); ctx.openAccess(request.member_id); }
  }
  return (
    <Modal title={'Talebi onayla — ' + (m?.company || '')} close={close} message={error}>
      <form onSubmit={submit}>
        {m && <ContactInfo m={m} />}
        <p className="hint">Onayladığınız alanlar firmaya program yetkisi olarak açılır. Firma, siz CV atayana kadar mezun bilgisi göremez.</p>
        <div className="items edit">
          {items.map((i: any, n: number) => {
            const l = itemLabel(data.catalog, i);
            return <div key={i.programId + i.areaId}>
              <label className="check"><input type="checkbox" checked={i.on} onChange={(e) => setItems(items.map((x: any, k: number) => k === n ? {...x, on: e.target.checked} : x))} />{l.program} › <b>{l.area}</b></label>
              <label className="quota">Kontenjan<input type="number" min={1} max={999} value={i.quota} onChange={(e) => setItems(items.map((x: any, k: number) => k === n ? {...x, quota: Number(e.target.value) || 1} : x))} /></label>
            </div>;
          })}
        </div>
        {request.other_label && (
          <div className="items" style={{marginTop: 10}}>
            <div><span>Diğer › <b>{request.other_label}</b></span><span className="quota-badge">Kontenjan: {request.other_quota}</span></div>
            <p className="hint">Diğer teknoloji alanı menüde yer almaz; onay sonrası gerekirse manuel yetki / CV ataması yapın.</p>
          </div>
        )}
        {!!request.work_models?.length && <p className="hint">Tercih Edilen Çalışma Modeli: <b>{formatWorkModels(request.work_models)}</b></p>}
        <Input label="Erişim bitiş tarihi" type="date" required value={expires} onChange={(e: any) => setExpires(e.target.value)} />
        <div className="modalfoot"><Button disabled={ctx.busy}><Check size={16} />Onayla</Button></div>
      </form>
    </Modal>
  );
}

// Firma yetkileri ve CV atama penceresi.
export function AccessModal({ctx, memberId, grantId, close}: {ctx: AdminCtx; memberId: string; grantId?: string; close: () => void}) {
  const {data} = ctx;
  const m = data.members.find((x) => x.id === memberId);
  const grants = data.grants.filter((g) => g.member_id === memberId);
  const assigned = useMemo(() => new Set(data.assignments.filter((a) => a.member_id === memberId).map((a) => a.profile_id)), [data.assignments, memberId]);
  const [filter, setFilter] = useState<string>(grantId || (grants[0]?.id ?? 'assigned'));
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [newGrant, setNewGrant] = useState({programId: '', areaId: '', quota: 1});
  const activeGrant = grants.find((g) => g.id === filter);
  const published = data.profiles.filter((p) => p.status === 'published' && p.evidence);
  const list = published.filter((p) => {
    if (filter === 'assigned' && !assigned.has(p.id)) return false;
    if (activeGrant) { const l = itemLabel(data.catalog, activeGrant); if (!matchesGrant(p, l.program, activeGrant.area_id ? l.area : '')) return false; }
    return !query || normalize([p.name, p.city, p.classGroup, p.program, p.university, p.skills].join(' ')).includes(normalize(query));
  });
  const program = data.catalog.find((p) => p.id === newGrant.programId);
  if (!m) return null;
  const toggleAll = (on: boolean) => setSelected(on ? list.map((p) => p.id) : []);

  async function assign(remove = false) {
    const d = await ctx.act(remove ? {action: 'unassign', memberId, profileIds: selected} : {action: 'assign', memberId, profileIds: selected, grantId: activeGrant?.id}, remove ? 'CV erişimi kaldırıldı.' : 'CV’ler firmaya açıldı.');
    if (d) setSelected([]);
  }

  return (
    <Modal title={'Yetkiler ve CV atama — ' + m.company} close={close} wide>
      <ContactInfo m={m} />
      <p className="hint">Durum: <b>{memberStatus(m.status)}</b> · Erişim bitişi: <b>{m.expires || '—'}</b> · Açık CV: <b>{assigned.size}</b></p>
      <h3 className="formsection">Program yetkileri</h3>
      {grants.length ? <div className="tablewrap"><table><thead><tr><th>Program</th><th>Alan</th><th>Açılan / kontenjan</th><th>İşlem</th></tr></thead><tbody>
        {grants.map((g) => { const l = itemLabel(data.catalog, g); return <tr key={g.id} className={filter === g.id ? 'rowactive' : ''}><td>{l.program}</td><td>{l.area}</td><td><b>{assignedFor(data, g)}</b> / {g.quota}</td><td><button className="textbtn" onClick={() => { setFilter(g.id); setSelected([]); }}>CV ata</button> <button className="textbtn danger" disabled={ctx.busy} onClick={async () => { if (confirm('Bu program yetkisi kaldırılsın mı? Bu yetki üzerinden açılan CV’lerin erişimi de kapanır.')) await ctx.act({action: 'grant-delete', id: g.id}, 'Yetki kaldırıldı.'); }}><Trash2 size={14} />Kaldır</button></td></tr>; })}
      </tbody></table></div> : <p className="muted">Henüz program yetkisi yok.</p>}
      <form className="inlineform" onSubmit={async (e) => { e.preventDefault(); const d = await ctx.act({action: 'grant-save', memberId, ...newGrant}, 'Program yetkisi eklendi.'); if (d) setNewGrant({programId: '', areaId: '', quota: 1}); }}>
        <select required value={newGrant.programId} onChange={(e) => setNewGrant({...newGrant, programId: e.target.value, areaId: ''})}><option value="">Program seçin</option>{data.catalog.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select required={!!program?.areas.some((a: any) => a.active)} value={newGrant.areaId} onChange={(e) => setNewGrant({...newGrant, areaId: e.target.value})}><option value="">{program?.areas.some((a: any) => a.active) ? 'Alan seçin' : 'Tüm program'}</option>{program?.areas.filter((a: any) => a.active).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <input type="number" min={1} max={999} aria-label="Kontenjan" value={newGrant.quota} onChange={(e) => setNewGrant({...newGrant, quota: Number(e.target.value) || 1})} />
        <Button secondary disabled={ctx.busy}><Plus size={15} />Yetki ekle</Button>
      </form>

      <h3 className="formsection">CV atama</h3>
      <div className="filters">
        <select aria-label="Liste" value={filter} onChange={(e) => { setFilter(e.target.value); setSelected([]); }}>
          {grants.map((g) => { const l = itemLabel(data.catalog, g); return <option key={g.id} value={g.id}>{l.program} › {l.area} (kontenjan {g.quota})</option>; })}
          <option value="assigned">Firmaya açık CV’ler ({assigned.size})</option>
          <option value="all">Tüm yayındaki mezunlar (doğrudan CV göster)</option>
        </select>
        <label className="searchmini"><Search size={15} /><input placeholder="Ara…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      </div>
      {activeGrant && <p className="hint">Bu yetki için <b>{assignedFor(data, activeGrant)}</b> / {activeGrant.quota} CV açık. Listede programı ve alanı (Bootcamp Sınıfı) eşleşen yayındaki mezunlar görünür.</p>}
      <div className="tablewrap"><table><thead><tr><th><input type="checkbox" aria-label="Tümünü seç" checked={!!list.length && selected.length === list.length} onChange={(e) => toggleAll(e.target.checked)} /></th><th>Mezun</th><th>Program / alan</th><th>Şehir</th><th>Firmaya açık</th></tr></thead><tbody>
        {list.map((p) => <tr key={p.id}><td><input type="checkbox" aria-label={p.name + ' seç'} checked={selected.includes(p.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))} /></td><td><b>{p.name}</b><small>{p.email}</small></td><td>{p.classGroup}<small>{p.program}</small></td><td>{p.city || '—'}</td><td>{assigned.has(p.id) ? <span className="status published">Açık</span> : <span className="muted">—</span>}</td></tr>)}
      </tbody></table></div>
      {!list.length && <div className="empty">Bu filtrede yayındaki mezun yok.</div>}
      <div className="modalfoot">
        <Button disabled={ctx.busy || !selected.length} onClick={() => assign(false)}><Check size={16} />Seçilenleri firmaya aç ({selected.length})</Button>
        <Button secondary disabled={ctx.busy || !selected.some((id) => assigned.has(id))} onClick={() => assign(true)}><X size={16} />Seçilenlerin erişimini kaldır</Button>
      </div>
    </Modal>
  );
}
