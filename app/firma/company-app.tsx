'use client';
import {useCallback, useEffect, useState} from 'react';
import {Users, Briefcase, Layers, Trophy, UserCog, Search, MapPin, Download, GraduationCap, ArrowUpRight, RotateCcw, Mail, Plus, Clock, ExternalLink, Send} from 'lucide-react';
import {Shell, Feedback, useApi, PasswordForm, PageTitle, Button, Modal, Input, ProgramPicker, WorkModelPicker, itemLabel, formatWorkModels, saveFile, date, initials, type Tab, type Item} from '../components/ui';
import {AwardsTab} from '../components/awards';
import {normalize, matchesGrant, stages, PENDING_STAGE, REJECTED_STAGE} from '../../lib/model';

type Data = {member: any; profiles: any[]; placements: any[]; grants: any[]; requests: any[]; catalog: any[]; allPrograms: any[]};
const emptyData: Data = {member: null, profiles: [], placements: [], grants: [], requests: [], catalog: [], allPrograms: []};

function StageBadge({stage}: {stage: string}) {
  const cls = stage === PENDING_STAGE ? 'pending' : stage === REJECTED_STAGE ? 'hidden' : 'published';
  const text = stage === PENDING_STAGE ? 'Onay bekliyor' : stage === REJECTED_STAGE ? 'Onaylanmadı' : stage;
  return <span className={'status ' + cls}>{text}</span>;
}

export default function CompanyApp() {
  const [data, setData] = useState<Data>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('candidates');
  const api = useApi('/api/company');

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/company');
      if (r.status === 401 || r.status === 403) { window.location.assign('/'); return; }
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e: any) { api.setError(e.message || 'Veri yüklenemedi.'); } finally { setLoaded(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  async function act(body: any, success?: string) {
    const d = await api.call(body, success);
    if (d) await refresh();
    return d;
  }

  const pendingHiring = data.placements.filter((p) => p.stage === PENDING_STAGE).length;
  const tabs: Tab[] = [
    {key: 'candidates', label: 'Adaylarım', icon: Users, group: 'ÇALIŞMA ALANI', badge: data.profiles.length},
    {key: 'process', label: 'İşe alım süreçlerim', icon: Briefcase, group: 'ÇALIŞMA ALANI', badge: pendingHiring},
    {key: 'programs', label: 'Yetkili programlarım', icon: Layers, group: 'ÇALIŞMA ALANI'},
    {key: 'awards', label: 'Etki ve ödüller', icon: Trophy, group: 'ÇALIŞMA ALANI'},
    {key: 'account', label: 'Hesabım', icon: UserCog, group: 'HESAP'},
  ];
  const m = data.member;
  return (
    <Shell tabs={tabs} tab={tab} onTab={setTab} account={{title: m?.company || 'Firma', sub: m?.email || '', initials: initials(m?.company || 'F')}}>
      <Feedback error={api.error} setError={api.setError} notice={api.notice} />
      <main className="content">
        {!loaded ? <div className="empty">Yükleniyor…</div> : <>
          {tab === 'candidates' && <Candidates data={data} act={act} busy={api.busy} setError={api.setError} go={setTab} />}
          {tab === 'process' && <Process data={data} act={act} busy={api.busy} />}
          {tab === 'programs' && <Programs data={data} act={act} busy={api.busy} />}
          {tab === 'awards' && <AwardsTab placements={data.placements} company={m?.company} />}
          {tab === 'account' && <>
            <PageTitle title="Hesabım" desc="Firma bilgileriniz ve giriş şifreniz." />
            <div className="split">
              <section className="panel"><h3>Firma bilgileri</h3><div className="details">{[['Firma', m.company], ['Yetkili', m.name], ['Unvan', m.title], ['E-posta', m.email], ['Telefon', m.phone], ['Web sitesi', m.website], ['Şehir', m.city], ['Erişim bitişi', m.expires]].map(([l, v]) => <div key={l}><small>{l}</small><b>{v || 'Belirtilmedi'}</b></div>)}</div><p className="hint">Bilgilerinizde değişiklik için Akademi ekibiyle iletişime geçin.</p></section>
              <PasswordForm />
            </div>
          </>}
        </>}
      </main>
    </Shell>
  );
}

function Candidates({data, act, busy, setError, go}: {data: Data; act: any; busy: boolean; setError: (s: string) => void; go: (t: string) => void}) {
  const list = data.profiles;
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [hire, setHire] = useState<any>(null);
  const placementOf = (id: string) => data.placements.find((p) => p.candidate === id);
  const filtered = list.filter((g) => (!query || normalize([g.name, g.skills, g.classGroup, g.program, g.university, g.city].join(' ')).includes(normalize(query))) && (!program || g.program === program) && (!area || g.classGroup === area) && (!city || g.city === city));
  const uniq = (k: string) => [...new Set(list.map((g) => g[k]).filter(Boolean))].sort((a: any, b: any) => a.localeCompare(b, 'tr'));

  async function detail(g: any) {
    const d = await act({action: 'detail', id: g.id}, '');
    if (d) setSelected(d.profile);
  }
  async function download(g: any) {
    try {
      const r = await fetch('/api/cv/' + g.id);
      if (!r.ok) throw new Error(((await r.json()) as any).error);
      if (r.headers.get('content-type')?.includes('application/json')) { const d: any = await r.json(); window.open(d.url, '_blank', 'noopener'); return; }
      saveFile(await r.blob(), 'GY_CV_' + g.name.replace(/\s+/g, '_') + '.pdf');
    } catch (e: any) { setError(e.message); }
  }

  return <>
    <section className="hero"><div className="heroCopy"><div className="eyebrow"><span />GELECEĞE BİRLİKTE YER AÇALIM</div><h1>Bir sonraki ekip arkadaşınız<br /><em>burada olabilir.</em></h1><p>Akademinin sizin için açtığı Geleceği Yazanlar mezunlarıyla tanışın.</p><button onClick={() => go('programs')}>Yeni program talep edin <ArrowUpRight size={16} /></button></div><div className="heroright"><div className="orbit"><span className="orbittag t1"><span />Yazılım</span><span className="orbittag t2"><span />Yapay zekâ</span><span className="orbittag t3"><span />Tasarım</span><div className="orbcore"><GraduationCap size={43} /><b>YETENEKLE<br />BULUŞUN</b></div></div></div></section>
    <div className="sectiontitle"><div><h2>Size açılan adaylar</h2><p>Yalnızca Akademinin sizinle paylaştığı mezunlar listelenir.</p></div><span className="pill"><span className="dot" />{list.length} aday</span></div>
    <div className="searchbar"><Search size={21} /><input aria-label="Aday ara" placeholder="İsim, teknoloji, üniversite veya anahtar kelime ara…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
    <div className="filters">
      <select aria-label="Program" value={program} onChange={(e) => setProgram(e.target.value)}><option value="">Tüm programlar</option>{uniq('program').map((x: any) => <option key={x}>{x}</option>)}</select>
      <select aria-label="Alan" value={area} onChange={(e) => setArea(e.target.value)}><option value="">Tüm alanlar</option>{uniq('classGroup').map((x: any) => <option key={x}>{x}</option>)}</select>
      <select aria-label="Şehir" value={city} onChange={(e) => setCity(e.target.value)}><option value="">Tüm şehirler</option>{uniq('city').map((x: any) => <option key={x}>{x}</option>)}</select>
      <button className="textbtn" onClick={() => { setQuery(''); setProgram(''); setArea(''); setCity(''); }}><RotateCcw size={14} />Sıfırla</button>
    </div>
    <div className="cards">{filtered.map((g, i) => { const place = placementOf(g.id); return (
      <article key={g.id} className="candidate" onClick={() => detail(g)} tabIndex={0} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); detail(g); } }}>
        <div className="cardtop"><span className={'avatar color' + i % 6}>{initials(g.name)}</span>{place ? <StageBadge stage={place.stage} /> : <span className="available"><span />{g.work || 'Mezun'}</span>}</div>
        <h3>{g.name}</h3>
        <div className="location"><MapPin size={14} />{g.city || 'Şehir belirtilmedi'}<span>·</span>{g.period || 'Dönem belirtilmedi'}</div>
        <div className="discipline">{g.classGroup}</div>
        <div className="tags">{String(g.skills || '').split(',').filter(Boolean).slice(0, 3).map((s: string) => <span key={s}>{s.trim()}</span>)}</div>
        <div className="program"><GraduationCap size={16} /><span>{g.program}</span></div>
        <div className="cardfoot"><button className="textbtn" onClick={(e) => { e.stopPropagation(); detail(g); }}>Profili incele <ArrowUpRight size={15} /></button><button className="cvbtn" disabled={!g.hasCv} onClick={(e) => { e.stopPropagation(); download(g); }}><Download size={15} />{g.hasCv ? 'CV indir' : 'CV bekleniyor'}</button></div>
      </article>); })}</div>
    {!filtered.length && <div className="empty"><Search size={32} /><h3>{list.length ? 'Eşleşen aday bulunamadı' : 'Henüz size açılmış aday yok'}</h3><p>{list.length ? 'Filtreleri değiştirerek yeniden deneyin.' : 'Akademi talebinize uygun mezunların CV’lerini açtığında burada görünecek.'}</p></div>}

    {selected && <Modal title="Mezun profili" close={() => setSelected(null)} wide>
      <div className="profileintro"><span className="avatar large">{initials(selected.name)}</span><div><h2>{selected.name}</h2><p><MapPin size={15} />{selected.city} · {selected.classGroup}</p><span className="status published">{selected.work || 'Mezun'}</span></div></div>
      <div className="tags">{String(selected.skills || '').split(',').filter(Boolean).map((x: string) => <span key={x}>{x}</span>)}</div>
      <div className="details">{[['Program', selected.program], ['Mezun dönemi', selected.period], ['Üniversite', selected.university], ['Bölüm', selected.department], ['Mezuniyet yılı', selected.year], ['Ortalama', selected.gpa], ['Çalışılan kurum', selected.employer], ['E-posta', selected.contactEmail || 'İşe alım talebi onaylandığında görünür']].map(([l, v]) => <div key={l}><small>{l}</small><b>{v || 'Belirtilmedi'}</b></div>)}</div>
      <div className="toolbar">{['github', 'linkedin'].map((k) => selected[k] && <a key={k} className="btn secondary" href={selected[k]} target="_blank" rel="noreferrer">{k === 'github' ? 'GitHub' : 'LinkedIn'}<ExternalLink size={15} /></a>)}</div>
      <div className="modalfoot">
        <Button disabled={!selected.hasCv} onClick={() => download(selected)}><Download size={17} />{selected.hasCv ? 'CV indir' : 'CV henüz yüklenmedi'}</Button>
        {placementOf(selected.id)
          ? <span className="hirestate"><StageBadge stage={placementOf(selected.id).stage} /> <button className="textbtn" onClick={() => { setSelected(null); go('process'); }}>İşe alım süreçlerimde gör</button></span>
          : <Button secondary disabled={busy} onClick={() => { setHire({candidate: selected.id, name: selected.name, role: ''}); setSelected(null); }}><Send size={16} />Talebe geçildi — işe alım sürecine ekle</Button>}
      </div>
    </Modal>}

    {hire && <Modal title="İşe alım sürecine ekle" close={() => setHire(null)}>
      <form onSubmit={async (e) => { e.preventDefault(); const d = await act({action: 'hire', candidate: hire.candidate, role: hire.role}, 'Talebiniz Akademiye iletildi. Onaylandığında öğrencinin e-postası görünecek.'); if (d) { setHire(null); go('process'); } }}>
        <p><b>{hire.name}</b> ile işe alım sürecine başlamak istediğinizi Akademiye bildirin. Kayıt “İşe alım süreçlerim” sayfanızda <b>Onay bekliyor</b> olarak görünür.</p>
        <Input label="Pozisyon (isteğe bağlı)" maxLength={200} value={hire.role} onChange={(e: any) => setHire({...hire, role: e.target.value})} />
        <div className="modalfoot"><Button disabled={busy}><Send size={16} />Talebi gönder</Button></div>
      </form>
    </Modal>}
  </>;
}

function Process({data, act, busy}: {data: Data; act: any; busy: boolean}) {
  const [edit, setEdit] = useState<any>(null);
  const profile = (id: string) => data.profiles.find((p) => p.id === id);
  return <>
    <PageTitle title="İşe alım süreçlerim" desc="“İşe alım sürecine ekle” dediğiniz adaylar. Akademi onayladığında öğrencinin e-postası açılır ve aşamaları güncelleyebilirsiniz." />
    {data.placements.length ? <div className="tablewrap"><table><thead><tr><th>Aday</th><th>Pozisyon</th><th>Durum</th><th>İletişim</th><th>Güncelleme</th><th>İşlem</th></tr></thead><tbody>
      {data.placements.map((p) => { const g = profile(p.candidate); return <tr key={p.id}>
        <td><b>{g?.name || 'Erişimi kaldırılmış aday'}</b><small>{g?.program}{g?.classGroup ? ' › ' + g.classGroup : ''}</small></td>
        <td>{p.role || '—'}</td>
        <td><StageBadge stage={p.stage} /></td>
        <td>{p.approved && g?.contactEmail ? <a href={'mailto:' + g.contactEmail}><Mail size={13} /> {g.contactEmail}</a> : p.stage === PENDING_STAGE ? <span className="muted"><Clock size={13} /> Akademi onayı bekleniyor</span> : <span className="muted">—</span>}</td>
        <td>{date(p.updated)}</td>
        <td>{p.approved && g && <button className="textbtn" onClick={() => setEdit({...p})}>Aşamayı güncelle</button>}</td>
      </tr>; })}
    </tbody></table></div> : <div className="empty"><Briefcase size={32} /><h3>Henüz işe alım süreciniz yok</h3><p>Aday profilindeki “İşe alım sürecine ekle” düğmesiyle başlatabilirsiniz.</p></div>}

    {edit && <Modal title="İşe alım aşaması" close={() => setEdit(null)}>
      <form onSubmit={async (e) => { e.preventDefault(); const d = await act({action: 'stage', ...edit}); if (d) setEdit(null); }}>
        <p><b>{profile(edit.candidate)?.name}</b></p>
        <Input label="Pozisyon" value={edit.role || ''} onChange={(e: any) => setEdit({...edit, role: e.target.value})} />
        <label className="field">Aşama<select value={edit.stage} onChange={(e) => setEdit({...edit, stage: e.target.value})}>{stages.map((s) => <option key={s}>{s}</option>)}</select></label>
        <Input label="İşe başlama tarihi" type="date" required={edit.stage === 'İşe başladı'} value={edit.start || ''} onChange={(e: any) => setEdit({...edit, start: e.target.value})} />
        {[['firstJob', 'Mezunun ilk profesyonel işi'], ['woman', 'Kadın teknoloji istihdamı (beyan)']].map(([k, l]) => <label className="check" key={k}><input type="checkbox" checked={!!edit[k]} onChange={(e) => setEdit({...edit, [k]: e.target.checked})} />{l}</label>)}
        <p className="hint">İşe başlama bilgisi Akademi tarafından teyit edildikten sonra ödül göstergelerine dahil edilir.</p>
        <div className="modalfoot"><Button disabled={busy}>Kaydet</Button></div>
      </form>
    </Modal>}
  </>;
}

function Programs({data, act, busy}: {data: Data; act: any; busy: boolean}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [otherOn, setOtherOn] = useState(false);
  const [otherLabel, setOtherLabel] = useState('');
  const [otherQuota, setOtherQuota] = useState('');
  const [workModels, setWorkModels] = useState<string[]>([]);
  const opened = (g: any) => { const l = itemLabel(data.allPrograms, g); return data.profiles.filter((p) => matchesGrant(p, l.program, g.area_id ? l.area : '')).length; };
  return <>
    <PageTitle title="Yetkili programlarım" desc="Akademinin size açtığı program ve alanlar, talep ettiğiniz kontenjan ve açılan CV sayısı." />
    <Button onClick={() => { setItems([]); setNote(''); setError(''); setOtherOn(false); setOtherLabel(''); setOtherQuota(''); setWorkModels([]); setOpen(true); }}><Plus size={17} />Yeni CV talebi oluştur</Button>
    {data.grants.length ? <div className="tablewrap space"><table><thead><tr><th>Program</th><th>Alan</th><th>Kontenjan</th><th>Açılan CV</th></tr></thead><tbody>
      {data.grants.map((g) => { const l = itemLabel(data.allPrograms, g); return <tr key={g.id}><td>{l.program}</td><td>{l.area}</td><td>{g.quota}</td><td><b>{opened(g)}</b></td></tr>; })}
    </tbody></table></div> : <div className="empty space">Henüz size açılmış program yok.</div>}
    {data.requests.length > 0 && <>
      <div className="sectiontitle"><h2>Taleplerim</h2></div>
      <div className="tablewrap"><table><thead><tr><th>Tarih</th><th>Talep</th><th>Durum</th></tr></thead><tbody>
        {data.requests.map((r) => <tr key={r.id}><td>{date(r.created_at)}</td><td>{r.items.map((i: any) => { const l = itemLabel(data.allPrograms, i); return <small key={i.programId + i.areaId}>{l.program} › {l.area} — kontenjan {i.quota}</small>; })}{r.other_label && <small>Diğer › {r.other_label} — kontenjan {r.other_quota}</small>}{!!r.work_models?.length && <small>Çalışma modeli: {formatWorkModels(r.work_models)}</small>}</td><td><span className={'status ' + (r.status === 'approved' ? 'published' : r.status === 'pending' ? 'pending' : 'hidden')}>{r.status === 'approved' ? 'Onaylandı' : r.status === 'pending' ? 'İnceleniyor' : 'Onaylanmadı'}</span></td></tr>)}
      </tbody></table></div>
    </>}
    {open && <Modal title="Yeni CV talebi" close={() => setOpen(false)} message={error} wide>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!items.length && !otherOn) { setError('En az bir program / alan seçin veya diğer teknoloji alanı talebi oluşturun.'); return; }
        if (items.some((i) => !i.quota)) { setError('Her alan için kontenjan girin.'); return; }
        if (otherOn) {
          if (!otherLabel.trim()) { setError('İhtiyaç duyulan teknoloji / uzmanlık alanını yazın.'); return; }
          const q = Number(otherQuota);
          if (!Number.isInteger(q) || q < 1) { setError('Talep edilen CV sayısını girin.'); return; }
        }
        if (!workModels.length) { setError('Lütfen en az bir çalışma modeli seçiniz.'); return; }
        const other = otherOn ? {enabled: true, label: otherLabel.trim(), quota: Number(otherQuota)} : {enabled: false};
        const d = await act({action: 'program-request', items, note, other, workModels}, 'Talebiniz Akademiye iletildi.');
        if (d) setOpen(false);
      }}>
        <p className="hint">Talebiniz yönetim paneline bildirim olarak düşer.</p>
        <WorkModelPicker value={workModels} onChange={setWorkModels} />
        <ProgramPicker
          catalog={data.catalog}
          value={items}
          onChange={setItems}
          other={{enabled: otherOn, label: otherLabel, quota: otherQuota, onEnabled: setOtherOn, onLabel: setOtherLabel, onQuota: setOtherQuota}}
        />
        <label className="field">Not (isteğe bağlı)<textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="modalfoot"><Button disabled={busy}><Send size={16} />Talebi gönder</Button></div>
      </form>
    </Modal>}
  </>;
}
