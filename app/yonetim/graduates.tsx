'use client';
import {useState} from 'react';
import {Plus, Upload, Trash2, Search, Building2} from 'lucide-react';
import {Button, Modal, Input, PageTitle} from '../components/ui';
import {fields, normalize} from '../../lib/model';
import type {AdminCtx} from './admin-app';

const statusLabel = (s: string) => s === 'published' ? 'Yayında' : s === 'hidden' ? 'Gizli' : 'İncelemede';

export function GraduatesTab({ctx}: {ctx: AdminCtx}) {
  const {data} = ctx;
  const list = data.profiles;
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [bulk, setBulk] = useState<{ids: string[]; evidence: string; confirmed: boolean} | null>(null);
  const [assign, setAssign] = useState<{memberId: string} | null>(null);
  const programs = [...new Set([...data.catalog.map((p) => p.name), ...list.map((p) => p.program).filter(Boolean)])];
  const filtered = list.filter((g) => (!query || normalize([g.name, g.email, g.classGroup, g.program, g.city, g.university].join(' ')).includes(normalize(query))) && (!program || g.program === program) && (!status || g.status === status));
  const pendingIds = list.filter((g) => g.status === 'pending').map((g) => g.id);
  const sel = selected.filter((id) => list.some((g) => g.id === id));

  async function uploadCv(id: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/cv/' + id, {method: 'POST', body: fd});
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      await ctx.refresh();
      ctx.setNotice('PDF kaydedildi.');
    } catch (e: any) {
      ctx.setError(e.message);
    }
  }
  async function remove(ids: string[]) {
    const names = ids.length === 1 ? (list.find((g) => g.id === ids[0])?.name || 'Kayıt') : ids.length + ' mezun';
    if (!confirm(names + ' silinsin mi? CV dosyaları, firma erişimleri, işe alım kayıtları ve ilgili bildirimler de kalıcı olarak silinir.')) return false;
    const d = await ctx.act({action: 'delete-profiles', ids}, ids.length === 1 ? 'Mezun silindi.' : ids.length + ' mezun silindi.');
    if (d) setSelected([]);
    return !!d;
  }
  const newProfile = () => setEdit(Object.fromEntries([...fields.map(([k]) => [k, '']), ['program', data.catalog[0]?.name || ''], ['status', 'pending'], ['evidence', '']]));

  return <>
    <PageTitle title="Mezun yönetimi" desc="Profilleri düzenleyin, paylaşım dayanağını doğrulayın, CV yükleyin, tekli veya toplu silin." />
    <div className="toolbar">
      <Button onClick={newProfile}><Plus size={17} />Mezun ekle</Button>
      <Button secondary disabled={ctx.busy || !pendingIds.length} onClick={() => setBulk({ids: pendingIds.slice(0, 500), evidence: '', confirmed: false})}>İncelemedekileri toplu yayımla ({pendingIds.length})</Button>
      <span className="muted">{list.length} kayıt</span>
    </div>
    <div className="filters">
      <label className="searchmini"><Search size={15} /><input aria-label="Mezun ara" placeholder="Ad, e-posta, alan, şehir…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <select aria-label="Program" value={program} onChange={(e) => setProgram(e.target.value)}><option value="">Tüm programlar</option>{programs.map((p) => <option key={p}>{p}</option>)}</select>
      <select aria-label="Durum" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tüm durumlar</option><option value="pending">İncelemede</option><option value="published">Yayında</option><option value="hidden">Gizli</option></select>
    </div>
    {sel.length > 0 && <div className="bulkbar">
      <b>{sel.length} mezun seçildi</b>
      <Button secondary disabled={ctx.busy} onClick={() => setAssign({memberId: ''})}><Building2 size={15} />Seçilenleri firmaya aç</Button>
      <Button className="dangerbtn" disabled={ctx.busy || sel.length > 500} onClick={() => remove(sel)}><Trash2 size={15} />Seçilenleri sil</Button>
      <button className="textbtn" onClick={() => setSelected([])}>Seçimi temizle</button>
    </div>}
    <div className="tablewrap"><table><thead><tr>
      <th><input type="checkbox" aria-label="Listedekilerin tümünü seç" checked={!!filtered.length && filtered.every((g) => sel.includes(g.id))} onChange={(e) => setSelected(e.target.checked ? [...new Set([...sel, ...filtered.map((g) => g.id)])] : sel.filter((id) => !filtered.some((g) => g.id === id)))} /></th>
      <th>Mezun</th><th>Program / alan</th><th>Şehir</th><th>Görünürlük</th><th>CV</th><th>İşlem</th>
    </tr></thead><tbody>
      {filtered.map((g) => <tr key={g.id}>
        <td><input type="checkbox" aria-label={g.name + ' seç'} checked={sel.includes(g.id)} onChange={(e) => setSelected(e.target.checked ? [...sel, g.id] : sel.filter((x) => x !== g.id))} /></td>
        <td><b>{g.name}</b><small>{g.email}</small></td>
        <td>{g.classGroup}<small>{g.program}</small></td>
        <td>{g.city}</td>
        <td><span className={'status ' + g.status}>{statusLabel(g.status)}</span></td>
        <td><label className="textbtn uploadlabel"><Upload size={15} />{g.hasCv ? 'PDF değiştir' : 'PDF yükle'}<input hidden type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadCv(g.id, f); }} /></label></td>
        <td className="actions"><button className="textbtn" onClick={() => setEdit({...g})}>Düzenle</button><button className="textbtn danger" aria-label={g.name + ' sil'} onClick={() => remove([g.id])}><Trash2 size={14} /></button></td>
      </tr>)}
    </tbody></table></div>
    {!filtered.length && <div className="empty">{list.length ? 'Filtreye uyan mezun yok.' : 'İlk mezununuzu ekleyerek veya Excel yükleyerek başlayın.'}</div>}

    {bulk && <Modal title="İncelemedeki mezunları toplu yayımla" close={() => { if (!ctx.busy) setBulk(null); }}>
      <form onSubmit={async (e) => { e.preventDefault(); if (!bulk.confirmed) return; const d = await ctx.act({action: 'publish-pending', ids: bulk.ids, evidence: bulk.evidence}, ''); if (d) { setBulk(null); ctx.setNotice(d.count + ' mezun yayımlandı.'); } }}>
        <p><b>{bulk.ids.length} mezun</b> incelemeden çıkarılıp yayına alınacak. Yayındaki mezunlar yalnızca siz CV’lerini açtığınız firmalara görünür.</p>
        <Input label="Ortak izin / belge referansı ve tarih" required value={bulk.evidence} onChange={(e: any) => setBulk({...bulk, evidence: e.target.value})} placeholder="İzinlerin toplandığı form/kayıt adı, metin sürümü ve tarih" />
        <label className="check"><input type="checkbox" checked={bulk.confirmed} onChange={(e) => setBulk({...bulk, confirmed: e.target.checked})} />Bu kayıtların tamamı için firma paylaşım izinlerinin alındığını ve yayımlanmalarını onaylıyorum.</label>
        <div className="modalfoot"><Button disabled={ctx.busy || !bulk.confirmed || !bulk.evidence.trim()}>{bulk.ids.length} mezunu yayımla</Button></div>
      </form>
    </Modal>}

    {assign && <Modal title="Seçilen CV’leri firmaya aç" close={() => setAssign(null)}>
      <form onSubmit={async (e) => { e.preventDefault(); const ids = sel.filter((id) => { const g = list.find((x) => x.id === id); return g?.status === 'published' && g.evidence; }); if (!ids.length) { ctx.setError('Seçilenler arasında yayında olan mezun yok.'); return; } const d = await ctx.act({action: 'assign', memberId: assign.memberId, profileIds: ids}, ''); if (d) { setAssign(null); setSelected([]); ctx.setNotice(d.count + ' CV firmaya açıldı.'); } }}>
        <p className="hint">Yalnızca yayındaki mezunlar firmaya açılır. Seçimdeki yayında olmayan kayıtlar atlanır.</p>
        <label className="field">Firma<select required value={assign.memberId} onChange={(e) => setAssign({memberId: e.target.value})}><option value="">Firma seçin</option>{data.members.filter((m) => m.status === 'approved').map((m) => <option key={m.id} value={m.id}>{m.company} · {m.email}</option>)}</select></label>
        <div className="modalfoot"><Button disabled={ctx.busy}>CV’leri aç</Button></div>
      </form>
    </Modal>}

    {edit && <Modal title={edit.id ? 'Mezunu düzenle' : 'Yeni mezun'} close={() => setEdit(null)} wide>
      <form onSubmit={async (e) => { e.preventDefault(); const d = await ctx.act({action: 'profile', profile: edit}); if (d) setEdit(null); }}>
        <div className="formgrid">{fields.map(([k, v]) => <Input key={k} label={v} value={edit[k] || ''} required={k === 'name' || k === 'email'} type={k === 'email' ? 'email' : 'text'} list={k === 'program' ? 'programlist' : k === 'classGroup' ? 'arealist' : undefined} onChange={(e: any) => setEdit({...edit, [k]: e.target.value})} />)}</div>
        <datalist id="programlist">{data.catalog.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        <datalist id="arealist">{[...new Set(data.catalog.flatMap((p) => p.areas.map((a: any) => a.name)))].map((a) => <option key={a} value={a} />)}</datalist>
        <label className="field">Görünürlük<select value={edit.status} onChange={(e) => setEdit({...edit, status: e.target.value})}><option value="pending">İncelemede</option><option value="published">Yayında</option><option value="hidden">Gizli</option></select></label>
        <Input label="Paylaşım dayanağı / belge referansı ve tarih" placeholder="Örn. Mezun paylaşım kaydı, metin sürümü, tarih ve belge no" value={edit.evidence || ''} onChange={(e: any) => setEdit({...edit, evidence: e.target.value})} />
        <p className="hint">Program ve Bootcamp Sınıfı alanları, firma yetkilerindeki Program › Alan ile eşleştirilir. CV Yükleme alanındaki HTTPS bağlantısı CV butonundan açılır; PDF yüklerseniz PDF öncelikli kullanılır.</p>
        <div className="modalfoot">
          <Button disabled={ctx.busy}>Kaydet</Button>
          {edit.id && <button type="button" className="textbtn danger" onClick={async () => { if (await remove([edit.id])) setEdit(null); }}><Trash2 size={16} />Kaydı sil</button>}
        </div>
      </form>
    </Modal>}
  </>;
}
