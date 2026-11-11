'use client';
import {useEffect, useState} from 'react';
import {Download, Copy, ShieldCheck, ExternalLink} from 'lucide-react';
import {Button, Modal, PageTitle, date} from '../components/ui';
import type {AdminCtx} from './admin-app';
export {AwardsTab} from '../components/awards';

export function PrivacyTab({events}: {events: any[]}) {
  return <>
    <PageTitle title="Veri ve erişim kontrolü" desc="Mezun görünürlüğü, paylaşım kayıtları ve firma erişimi tek yerde." />
    <div className="split">
      <div className="panel"><ShieldCheck className="blue" /><h3>Yayın öncesi kontrol</h3><p>Excel aktarımı kişisel verileri paylaşmak için tek başına yeterli değildir. Mezun kaydında paylaşım dayanağı / belge referansı bulunmalı ve admin “Yayında” durumunu seçmelidir.</p><a href="https://www.kvkk.gov.tr/Icerik/7261/2021-1051" target="_blank" rel="noreferrer">KVKK 2021/1051 — İstihdam platformları <ExternalLink size={13} /></a></div>
      <div className="panel"><h3>Firma erişimi</h3><p>Firmalar yalnızca yöneticinin açtığı CV’leri görür. Liste ve detayda telefon / e-posta gösterilmez; öğrencinin e-postası yalnızca yönetici işe alım talebini onayladıktan sonra açılır.</p><p>Erişim durdurulduğunda, süresi dolduğunda veya CV erişimi kaldırıldığında sonraki istekler reddedilir. Daha önce indirilen kopyalar geri alınamaz.</p></div>
    </div>
    <div className="sectiontitle"><h2>Son erişim ve işlem kayıtları</h2><span className="muted">Son 100 işlem</span></div>
    <div className="tablewrap"><table><thead><tr><th>Tarih</th><th>Kullanıcı</th><th>Firma</th><th>İşlem</th><th>Kayıt</th></tr></thead><tbody>
      {events.map((e) => <tr key={e.id}><td>{date(e.at)}</td><td>{e.actor}</td><td>{e.company}</td><td>{e.action}</td><td><small>{e.target || '—'}</small></td></tr>)}
    </tbody></table></div>
    {!events.length && <div className="empty">İşlemler gerçekleştiğinde denetim kaydı burada görünür.</div>}
  </>;
}

export function BrandingTab({ctx}: {ctx: AdminCtx}) {
  const [version, setVersion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/logo?meta').then((r) => r.json()).then((d: any) => setVersion(d.version || '')).catch(() => {}); }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(reset = false) {
    setBusy(true);
    try {
      const f = new FormData();
      if (reset) f.append('reset', 'true'); else if (file) f.append('file', file); else return;
      const r = await fetch('/api/logo', {method: 'POST', body: f});
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setVersion(d.version);
      setFile(null);
      window.dispatchEvent(new CustomEvent('gy-logo', {detail: d.version}));
      ctx.setNotice(reset ? 'Varsayılan logo geri yüklendi.' : 'Logo güncellendi.');
    } catch (e: any) { ctx.setError(e.message); } finally { setBusy(false); }
  }
  return <>
    <PageTitle title="Logo yönetimi" desc="Sol üstteki ana logoyu buradan değiştirin." />
    <section className="panel">
      <h3>Logo önizlemesi</h3>
      <div className="logo-preview"><img src={preview || (version ? '/api/logo?v=' + version : '/brand-logo.png')} alt="Logo önizlemesi" /></div>
      <p className="hint">PNG, JPG veya WebP · En fazla 2 MB.</p>
      <label className="field">Yeni logo dosyası<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 2 * 1024 * 1024) { ctx.setError('Logo en fazla 2 MB olabilir.'); return; } setFile(f); }} /></label>
      <div className="toolbar">
        <Button disabled={busy || !file} onClick={() => save()}>Logoyu kaydet</Button>
        {file && <Button secondary disabled={busy} onClick={() => setFile(null)}>Seçimi iptal et</Button>}
        <Button secondary disabled={busy || !version} onClick={() => save(true)}>Varsayılan logoya dön</Button>
      </div>
    </section>
  </>;
}

// QR kodu herkese açık talep formunu (/talep) açar.
export function QrModal({appUrl, close}: {appUrl: string; close: () => void}) {
  const link = (appUrl || window.location.origin) + '/talep';
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    import('qrcode').then((Q: any) => (Q.default || Q).toDataURL(link, {width: 400, margin: 2, color: {dark: '#082449', light: '#ffffff'}})).then(setQr).catch(() => {});
  }, [link]);
  return (
    <Modal title="Firma talep formu — QR ve bağlantı" close={close}>
      <div className="qr">
        {qr && <img src={qr} width="250" height="250" alt="Talep formu QR kodu" />}
        <p>QR kodu okutan firma yetkilisi talep formunu açar; bilgilerini ve talep ettiği program / alanları girer. Talep, yönetim paneline bildirim olarak düşer.</p>
        <div className="linkbox"><code>{link}</code><button className="textbtn" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}><Copy size={14} />{copied ? 'Kopyalandı' : 'Kopyala'}</button></div>
        {link.includes('localhost') && <p className="hint">Bağlantı şu an localhost adresini gösteriyor. Firmalarla paylaşmadan önce .env dosyasındaki APP_URL değerini erişilebilir adresle güncelleyin.</p>}
        {qr && <a className="btn primary" href={qr} download="GY_Kariyer_Agi_Talep_QR.png"><Download size={16} />QR kodunu indir</a>}
      </div>
    </Modal>
  );
}

const analysis = [
  ['01', 'Kullanıcı yolculuğu', 'QR, herkese açık talep formunu açar. Firma yetkilisi iletişim bilgilerini, talep ettiği Program › Alan seçimlerini ve kontenjanı girer, şifresini belirler. Talep yönetim paneline bildirim olarak düşer. Admin onaylar, program yetkisi verir ve CV’leri tek tek veya toplu açar. Firma yalnızca açılan CV’leri görür.'],
  ['02', 'Rol ayrımı', 'Yönetim paneli (/yonetim) yalnızca admin rolüne sunucu tarafında açılır. Firma kullanıcıları /firma paneline yönlendirilir; yönetim API’leri firma oturumuna 403 döner.'],
  ['03', 'İşe alım akışı', 'Firma “İşe alım sürecine ekle” dediğinde kayıt “Onay bekliyor” olarak firma panelinde görünür ve admin’e bildirim düşer. Admin onaylayınca öğrencinin e-postası firmaya açılır, firma aşamaları ilerletir.'],
  ['04', 'CV dosyaları', 'PDF CV’ler sunucudaki yerel depoda tutulur. Her indirmede oturum, firma durumu, erişim süresi ve CV ataması yeniden kontrol edilir.'],
  ['05', 'Bu sürümün sınırları', 'E-posta gönderimi yoktur; bildirimler panel içidir. Şifre sıfırlama admin tarafından yapılır. Zararlı dosya taraması ve otomatik saklama / imha işi yoktur.'],
];
export function AnalysisTab() {
  return <>
    <PageTitle title="Ürün ve uygulama analizi" desc="Kapsam, rol modeli ve bu sürümün sınırları." />
    <a className="btn secondary" href="/analiz.md" download><Download size={16} />Detaylı analizi indir</a>
    <div className="analysis">{analysis.map(([n, t, d]) => <section key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></section>)}</div>
  </>;
}
