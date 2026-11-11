'use client';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {X, Menu, ChevronRight, LogOut, ShieldCheck, AlertCircle, CheckCircle2, KeyRound} from 'lucide-react';
import {WORK_MODELS} from '../../lib/model';

export function saveFile(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
}

export function Button({children, secondary = false, className = '', ...props}: any) {
  return <button className={'btn ' + (secondary ? 'secondary' : 'primary') + (className ? ' ' + className : '')} {...props}>{children}</button>;
}

export function Modal({title, children, close, wide = false, message}: {title: string; children: ReactNode; close: () => void; wide?: boolean; message?: string}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className={wide ? 'wide' : ''} onCancel={(e) => { e.preventDefault(); close(); }}>
      <div className="modalhead"><h2>{title}</h2><button type="button" aria-label="Kapat" className="iconbtn" onClick={close}><X /></button></div>
      {message && <p className="alert error">{message}</p>}
      {children}
    </dialog>
  );
}

export const Input = ({label, ...props}: any) => <label className="field">{label}<input {...props} /></label>;

export function PageTitle({title, desc}: {title: string; desc: string}) {
  return <div className="pagetitle"><div className="eyebrow">GELECEĞİ YAZANLAR KARİYER AĞI</div><h1>{title}</h1><p>{desc}</p></div>;
}

export function Brand() {
  const [logoVersion, setLogoVersion] = useState('');
  useEffect(() => {
    fetch('/api/logo?meta').then((r) => r.json()).then((d: any) => setLogoVersion(d.version || '')).catch(() => {});
    const onChange = (e: any) => setLogoVersion(e.detail || '');
    window.addEventListener('gy-logo', onChange);
    return () => window.removeEventListener('gy-logo', onChange);
  }, []);
  return (
    <a className="brand" href="/" aria-label="Geleceği Yazanlar ana sayfa">
      <img
        className="custom-brand-logo"
        src={logoVersion ? '/api/logo?v=' + logoVersion : '/brand-logo.png'}
        alt="Geleceği Yazanlar"
        onError={() => setLogoVersion('')}
      />
    </a>
  );
}

export async function logout() {
  await fetch('/api/auth/logout', {method: 'POST'}).catch(() => {});
  window.location.assign('/giris');
}

export type Tab = {key: string; label: string; icon: any; group: string; badge?: number};

export function Shell({tabs, tab, onTab, account, actions, children}: {tabs: Tab[]; tab: string; onTab: (k: string) => void; account: {title: string; sub: string; initials: string}; actions?: ReactNode; children: ReactNode}) {
  const [nav, setNav] = useState(false);
  const groups = [...new Set(tabs.map((t) => t.group))];
  const current = tabs.find((t) => t.key === tab);
  return (
    <div className="shell">
      <aside className={'sidebar ' + (nav ? 'open' : '')}>
        <Brand />
        <div className="workspace">KARİYER AĞI <span>2026 / 27</span></div>
        <nav>
          {groups.map((g) => (
            <div key={g}>
              <div className="navlabel">{g}</div>
              {tabs.filter((t) => t.group === g).map((t) => {
                const I = t.icon;
                return <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => { onTab(t.key); setNav(false); }}><I size={18} />{t.label}{!!t.badge && <small>{t.badge}</small>}</button>;
              })}
            </div>
          ))}
        </nav>
        <div className="sidebottom">
          <div className="sidebadge"><ShieldCheck size={19} /><span>Yetkili erişim<br /><small>Mezunların verisi kontrol altında</small></span></div>
          <div className="account"><span className="avatar small">{account.initials}</span><div><b>{account.title}</b><small>{account.sub}</small></div></div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="mobile iconbtn" onClick={() => setNav(!nav)} aria-label="Menü"><Menu /></button>
          <span className="breadcrumb">Kariyer Ağı <ChevronRight size={14} /><b>{current?.label}</b></span>
          <div className="topactions">{actions}<button className="iconbtn" aria-label="Çıkış yap" title="Çıkış yap" onClick={logout}><LogOut size={18} /></button></div>
        </header>
        {children}
        <footer><span>Geleceği Yazanlar <b> / Kariyer Ağı</b></span></footer>
      </div>
    </div>
  );
}

export function Feedback({error, setError, notice}: {error: string; setError: (s: string) => void; notice: string}) {
  return (
    <>
      {error && <div className="alert error" role="alert"><AlertCircle size={18} />{error}<button onClick={() => setError('')} aria-label="Uyarıyı kapat"><X size={16} /></button></div>}
      {notice && <div className="toast" role="status"><CheckCircle2 size={19} />{notice}</div>}
    </>
  );
}

// API çağrıları için ortak durum: meşgul, hata ve bildirim.
export function useApi(endpoint: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  async function call(body: any, success = 'İşlem kaydedildi.') {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const d: any = await r.json();
      if (r.status === 401) { window.location.assign('/giris'); return null; }
      if (!r.ok) throw new Error(d.error || 'İşlem tamamlanamadı.');
      if (success) setNotice(success);
      return d;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return {busy, error, setError, notice, setNotice, call};
}

export type Catalog = {id: string; name: string; areas: {id: string; name: string}[]}[];
export type Item = {programId: string; areaId: string; quota: number};
export type OtherArea = {
  enabled: boolean;
  label: string;
  quota: string;
  onEnabled: (v: boolean) => void;
  onLabel: (v: string) => void;
  onQuota: (v: string) => void;
};

// Program > Alan seçimi ve her alan için talep edilen kontenjan.
export function ProgramPicker({catalog, value, onChange, other}: {catalog: Catalog; value: Item[]; onChange: (v: Item[]) => void; other?: OtherArea}) {
  const find = (programId: string, areaId: string) => value.find((x) => x.programId === programId && x.areaId === areaId);
  const toggle = (programId: string, areaId: string, on: boolean) => onChange(on ? [...value, {programId, areaId, quota: 1}] : value.filter((x) => !(x.programId === programId && x.areaId === areaId)));
  const setQuota = (programId: string, areaId: string, quota: number) => onChange(value.map((x) => x.programId === programId && x.areaId === areaId ? {...x, quota} : x));
  const row = (programId: string, areaId: string, label: string) => {
    const item = find(programId, areaId);
    return (
      <div className={'pickrow' + (item ? ' on' : '')} key={programId + areaId}>
        <label className="check"><input type="checkbox" checked={!!item} onChange={(e) => toggle(programId, areaId, e.target.checked)} />{label}</label>
        {item && <label className="quota">Kontenjan<input type="number" min={1} max={999} required value={item.quota || ''} onChange={(e) => setQuota(programId, areaId, Math.max(0, Math.min(999, Number(e.target.value) || 0)))} /><span>kişi</span></label>}
      </div>
    );
  };
  if (!catalog.length && !other) return <p className="hint">Şu anda talep edilebilecek aktif program yok.</p>;
  return (
    <div className="picker">
      {catalog.map((p) => (
        <fieldset key={p.id}>
          <legend>{p.name}</legend>
          {p.areas.length ? p.areas.map((a) => row(p.id, a.id, a.name)) : row(p.id, '', 'Tüm program')}
        </fieldset>
      ))}
      {other && (
        <fieldset>
          <legend>Diğer Teknoloji Alanları</legend>
          <p className="hint">Listelenen programlar dışında farklı bir teknoloji alanında mezun CV&apos;sine ihtiyaç duyuyorsanız aşağıdaki seçeneği işaretleyebilirsiniz.</p>
          <div className={'pickrow' + (other.enabled ? ' on' : '')}>
            <label className="check"><input type="checkbox" checked={other.enabled} onChange={(e) => other.onEnabled(e.target.checked)} />Diğer teknoloji alanında CV talep etmek istiyorum.</label>
          </div>
          {other.enabled && (
            <div className="other-fields">
              <label className="field">İhtiyaç duyulan teknoloji / uzmanlık alanı *<input required maxLength={200} placeholder="Örn. Siber Güvenlik, DevOps, İş Analistliği" value={other.label} onChange={(e) => other.onLabel(e.target.value)} /></label>
              <label className="quota">CV sayısı<input type="number" min={1} max={999} required placeholder="Örn. 5" value={other.quota} onChange={(e) => other.onQuota(e.target.value)} /><span>kişi</span></label>
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}

export {itemLabel, WORK_MODELS, formatWorkModels, parseWorkModels} from '../../lib/model';
export type {WorkModelId} from '../../lib/model';

export function WorkModelPicker({value, onChange}: {value: string[]; onChange: (v: string[]) => void}) {
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));
  return (
    <div className="work-models">
      <h3 className="formsection">Tercih Edilen Çalışma Modeli *</h3>
      <p className="hint">CV talep ettiğiniz pozisyonlar için uygun çalışma modelini seçiniz.</p>
      <div className="picker work-model-list">
        {WORK_MODELS.map(([id, label]) => (
          <div key={id} className={'pickrow' + (value.includes(id) ? ' on' : '')}>
            <label className="check"><input type="checkbox" checked={value.includes(id)} onChange={(e) => toggle(id, e.target.checked)} />{label}</label>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PasswordForm() {
  const api = useApi('/api/auth/password');
  const [f, setF] = useState({current: '', next: '', next2: ''});
  return (
    <section className="panel">
      <h3><KeyRound size={18} /> Şifre değiştir</h3>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (f.next !== f.next2) { api.setError('Yeni şifreler eşleşmiyor.'); return; }
        const d = await api.call({current: f.current, next: f.next}, 'Şifreniz değiştirildi.');
        if (d) setF({current: '', next: '', next2: ''});
      }}>
        <Input label="Mevcut şifre" type="password" required autoComplete="current-password" value={f.current} onChange={(e: any) => setF({...f, current: e.target.value})} />
        <Input label="Yeni şifre (en az 8 karakter)" type="password" required minLength={8} autoComplete="new-password" value={f.next} onChange={(e: any) => setF({...f, next: e.target.value})} />
        <Input label="Yeni şifre (tekrar)" type="password" required minLength={8} autoComplete="new-password" value={f.next2} onChange={(e: any) => setF({...f, next2: e.target.value})} />
        <Button disabled={api.busy}>Şifreyi güncelle</Button>
      </form>
      <Feedback error={api.error} setError={api.setError} notice={api.notice} />
    </section>
  );
}

export const date = (value?: string) => value ? new Date(value).toLocaleString('tr-TR', {timeZone: 'Europe/Istanbul'}) : '—';
export const initials = (name: string) => String(name || '?').split(' ').filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toLocaleUpperCase('tr-TR');

export function LogoutButton() {
  return <button className="btn secondary" onClick={logout}><LogOut size={16} />Çıkış yap</button>;
}
