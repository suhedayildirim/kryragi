'use client';
import {useEffect, useState} from 'react';
import {CheckCircle2, Send} from 'lucide-react';
import {Brand, Button, Input, ProgramPicker, WorkModelPicker, type Catalog, type Item} from '../components/ui';

const empty = {company: '', name: '', title: '', email: '', phone: '', website: '', city: '', note: '', password: '', password2: '', website_confirm: ''};

// QR kodu bu sayfayı açar: firma bilgileri + program/alan/kontenjan talebi.
export default function RequestForm() {
  const [catalog, setCatalog] = useState<Catalog>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState(empty);
  const [items, setItems] = useState<Item[]>([]);
  const [otherOn, setOtherOn] = useState(false);
  const [otherLabel, setOtherLabel] = useState('');
  const [otherQuota, setOtherQuota] = useState('');
  const [workModels, setWorkModels] = useState<string[]>([]);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    fetch('/api/public/catalog').then((r) => r.json()).then((d: any) => setCatalog(d.programs || [])).catch(() => setError('Program listesi yüklenemedi. Sayfayı yenileyin.')).finally(() => setLoading(false));
  }, []);
  const set = (k: keyof typeof empty) => (e: any) => setF({...f, [k]: e.target.value});
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!items.length && !otherOn) { setError('En az bir program / alan seçin veya diğer teknoloji alanı talebi oluşturun.'); return; }
    if (items.some((i) => !i.quota)) { setError('Seçtiğiniz her alan için kontenjan girin.'); return; }
    if (otherOn) {
      if (!otherLabel.trim()) { setError('İhtiyaç duyulan teknoloji / uzmanlık alanını yazın.'); return; }
      const q = Number(otherQuota);
      if (!Number.isInteger(q) || q < 1) { setError('Talep edilen CV sayısını girin.'); return; }
    }
    if (!workModels.length) { setError('Lütfen en az bir çalışma modeli seçiniz.'); return; }
    if (f.password !== f.password2) { setError('Şifreler eşleşmiyor.'); return; }
    setBusy(true);
    try {
      const other = otherOn ? {enabled: true, label: otherLabel.trim(), quota: Number(otherQuota)} : {enabled: false};
      const r = await fetch('/api/public/request', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...f, items, other, workModels, terms})});
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDone(true);
      window.scrollTo({top: 0});
    } catch (err: any) {
      setError(err.message || 'Talep gönderilemedi.');
    } finally {
      setBusy(false);
    }
  }
  if (done) return (
    <div className="authpage">
      <aside className="authside"><Brand /></aside>
      <main className="authmain"><div className="authcard center">
        <CheckCircle2 size={48} className="blue" />
        <h2>Talebiniz alındı</h2>
        <p>Akademi ekibi talebinizi inceleyecek. Onaylandığında <b>{f.email}</b> adresi ve belirlediğiniz şifreyle giriş yaparak size açılan mezun CV’lerini görebilirsiniz.</p>
        <a className="btn primary" href="/giris">Giriş sayfasına git</a>
      </div></main>
    </div>
  );
  return (
    <div className="authpage">
      <aside className="authside"><Brand /><h1>Aradığınız yeteneklere <em>Geleceği Yazanlar ile ulaşın!</em></h1><p>Firmanızın bilgilerini ve ihtiyaç duyduğunuz teknoloji alanlarını paylaşarak CV talebinizi hemen oluşturun. Turkcell Geleceği Yazanlar ekibi olarak ihtiyaçlarınıza uygun mezunlarımızın CV’lerini sizinle buluşturalım.</p></aside>
      <main className="authmain">
        <form className="authcard wide" onSubmit={submit}>
          <div className="eyebrow">GY KARİYER AĞI</div>
          <h2>Mezun CV talebi</h2>
          <h3 className="formsection">Firma ve yetkili bilgileri</h3>
          <div className="formgrid">
            <Input label="Firma ünvanı *" required maxLength={200} value={f.company} onChange={set('company')} />
            <Input label="Yetkili ad-soyad *" required maxLength={200} value={f.name} onChange={set('name')} />
            <Input label="Unvan / pozisyon" maxLength={200} value={f.title} onChange={set('title')} />
            <Input label="Kurumsal e-posta *" type="email" required maxLength={200} autoComplete="email" value={f.email} onChange={set('email')} />
            <Input label="Telefon *" type="tel" required maxLength={40} placeholder="05xx xxx xx xx" value={f.phone} onChange={set('phone')} />
            <Input label="Web sitesi" type="url" maxLength={200} placeholder="https://" value={f.website} onChange={set('website')} />
            <Input label="Şehir" maxLength={100} value={f.city} onChange={set('city')} />
          </div>
          <label className="honeypot" aria-hidden="true">Bu alanı boş bırakın<input tabIndex={-1} autoComplete="off" value={f.website_confirm} onChange={set('website_confirm')} /></label>
          <WorkModelPicker value={workModels} onChange={setWorkModels} />
          <h3 className="formsection">Talep edilen programlar ve kontenjan</h3>
          <p className="hint">İhtiyacınız olan alanları işaretleyin ve her alan için kaç mezunla görüşmek istediğinizi yazın.</p>
          {loading ? <p className="muted">Programlar yükleniyor…</p> : (
            <ProgramPicker
              catalog={catalog}
              value={items}
              onChange={setItems}
              other={{
                enabled: otherOn,
                label: otherLabel,
                quota: otherQuota,
                onEnabled: setOtherOn,
                onLabel: setOtherLabel,
                onQuota: setOtherQuota,
              }}
            />
          )}
          <label className="field">Not (isteğe bağlı)<textarea rows={3} maxLength={2000} value={f.note} onChange={set('note')} placeholder="Pozisyon, çalışma şekli, başlangıç tarihi vb." /></label>
          <h3 className="formsection">Giriş şifresi</h3>
          <p className="hint">Talebiniz onaylandığında bu e-posta ve şifreyle giriş yapacaksınız.</p>
          <div className="formgrid">
            <Input label="Şifre (en az 8 karakter) *" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} />
            <Input label="Şifre (tekrar) *" type="password" required minLength={8} autoComplete="new-password" value={f.password2} onChange={set('password2')} />
          </div>
          <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />CV’leri yalnızca işe alım amacıyla kullanacağımı, yetkisiz kişilerle paylaşmayacağımı ve aday haklarına ilişkin talepleri yerine getireceğimi; KVKK aydınlatma metnini okuduğumu kabul ediyorum.</label>
          {error && <p className="alert error" role="alert">{error}</p>}
          <Button disabled={busy || loading}><Send size={16} />{busy ? 'Gönderiliyor…' : 'Talebi gönder'}</Button>
          <p className="authalt">Zaten hesabınız var mı? <a href="/giris">Giriş yapın</a></p>
        </form>
      </main>
    </div>
  );
}
