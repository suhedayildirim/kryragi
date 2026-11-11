'use client';
import {useEffect, useState} from 'react';
import {CheckCircle2, Clock, Ban, Plus, Send} from 'lucide-react';
import {Brand, Button, Input, LogoutButton, ProgramPicker, WorkModelPicker, date, itemLabel, formatWorkModels, type Catalog, type Item} from '../components/ui';

type Member = {id: string; company: string; name: string; title: string; email: string; phone: string; website: string; city: string; status: string};
type Request = {id: string; type: string; items: Item[]; note: string; status: string; created_at: string; decided_at?: string; other_label?: string; other_quota?: number; work_models?: string[]};
type Data = {member: Member; requests: Request[]; catalog: Catalog; allPrograms: Catalog};

const statusLabel: Record<string, string> = {pending: 'İnceleniyor', approved: 'Onaylandı', rejected: 'Onaylanmadı'};
const statusClass: Record<string, string> = {pending: 'pending', approved: 'published', rejected: 'hidden'};

export default function RequestsPanel({initial}: {initial: {member: Member}}) {
  const [view, setView] = useState<'list' | 'form' | 'success'>('list');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({
    company: initial.member.company,
    name: initial.member.name,
    title: initial.member.title || '',
    phone: initial.member.phone || '',
    website: initial.member.website || '',
    city: initial.member.city || '',
    note: '',
  });
  const [items, setItems] = useState<Item[]>([]);
  const [otherOn, setOtherOn] = useState(false);
  const [otherLabel, setOtherLabel] = useState('');
  const [otherQuota, setOtherQuota] = useState('');
  const [workModels, setWorkModels] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/company');
      const d: any = await r.json();
      if (r.status === 401) { window.location.assign('/giris'); return; }
      if (!r.ok) throw new Error(d.error || 'Veriler yüklenemedi.');
      setData({member: d.member, requests: d.requests || [], catalog: d.catalog || [], allPrograms: d.allPrograms || d.catalog || []});
      setF({
        company: d.member.company,
        name: d.member.name,
        title: d.member.title || '',
        phone: d.member.phone || '',
        website: d.member.website || '',
        city: d.member.city || '',
        note: '',
      });
    } catch (e: any) {
      setError(e.message || 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const member = data?.member || initial.member;
  const requests = data?.requests || [];
  const catalog = data?.catalog || [];
  const labels = data?.allPrograms || catalog;

  function openForm() {
    setError('');
    setItems([]);
    setOtherOn(false);
    setOtherLabel('');
    setOtherQuota('');
    setWorkModels([]);
    setF((prev) => ({...prev, note: '', company: member.company, name: member.name, title: member.title || '', phone: member.phone || '', website: member.website || '', city: member.city || ''}));
    setView('form');
  }

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
    setBusy(true);
    try {
      const other = otherOn ? {enabled: true, label: otherLabel.trim(), quota: Number(otherQuota)} : {enabled: false};
      const r = await fetch('/api/company', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'cv-request', ...f, items, other, workModels}),
      });
      const d: any = await r.json();
      if (r.status === 401) { window.location.assign('/giris'); return; }
      if (!r.ok) throw new Error(d.error || 'Talep gönderilemedi.');
      await load();
      setView('success');
    } catch (err: any) {
      setError(err.message || 'Talep gönderilemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authpage">
      <aside className="authside">
        <Brand />
        <h1>{member.company}</h1>
        <p>{member.name} · {member.email}</p>
      </aside>
      <main className="authmain">
        {view === 'success' ? (
          <div className="authcard center">
            <CheckCircle2 size={48} className="blue" />
            <h2>Yeni CV talebiniz başarıyla alındı!</h2>
            <p>Geleceği Yazanlar ekibimiz talebinizi değerlendirecek ve ihtiyaçlarınıza uygun mezunlarımızın CV&apos;lerini sizinle paylaşacaktır.</p>
            <Button onClick={() => setView('list')}>CV Taleplerim</Button>
          </div>
        ) : view === 'form' ? (
          <form className="authcard wide" onSubmit={submit}>
            <div className="eyebrow">GY KARİYER AĞI</div>
            <h2>Yeni CV talebi</h2>
            <p className="hint">Firma bilgilerinizi güncelleyebilir, ihtiyaç duyduğunuz program / alanları seçebilirsiniz.</p>
            <h3 className="formsection">Firma ve yetkili bilgileri</h3>
            <div className="formgrid">
              <Input label="Firma ünvanı *" required maxLength={200} value={f.company} onChange={(e: any) => setF({...f, company: e.target.value})} />
              <Input label="Yetkili ad-soyad *" required maxLength={200} value={f.name} onChange={(e: any) => setF({...f, name: e.target.value})} />
              <Input label="Unvan / pozisyon" maxLength={200} value={f.title} onChange={(e: any) => setF({...f, title: e.target.value})} />
              <Input label="Kurumsal e-posta" type="email" value={member.email} disabled />
              <Input label="Telefon" type="tel" maxLength={40} placeholder="05xx xxx xx xx" value={f.phone} onChange={(e: any) => setF({...f, phone: e.target.value})} />
              <Input label="Web sitesi" type="url" maxLength={200} placeholder="https://" value={f.website} onChange={(e: any) => setF({...f, website: e.target.value})} />
              <Input label="Şehir" maxLength={100} value={f.city} onChange={(e: any) => setF({...f, city: e.target.value})} />
            </div>
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
            <label className="field">Not (isteğe bağlı)<textarea rows={3} maxLength={2000} value={f.note} onChange={(e) => setF({...f, note: e.target.value})} placeholder="Pozisyon, çalışma şekli, başlangıç tarihi vb." /></label>
            {error && <p className="alert error" role="alert">{error}</p>}
            <div className="toolbar">
              <Button disabled={busy || loading}><Send size={16} />{busy ? 'Gönderiliyor…' : 'Talebi gönder'}</Button>
              <Button type="button" secondary disabled={busy} onClick={() => setView('list')}>Vazgeç</Button>
            </div>
          </form>
        ) : (
          <div className="authcard wide-requests">
            {member.status === 'pending' ? <Clock size={40} className="blue" /> : <Ban size={40} className="blue" />}
            <h2>CV Taleplerim</h2>
            <p>Oluşturduğunuz CV taleplerini ve değerlendirme durumlarını bu ekrandan takip edebilir, yeni ihtiyaçlarınız için CV talebi oluşturabilirsiniz.</p>
            {member.status === 'pending' && (
              <p className="hint" style={{marginTop: 8}}>
                <b>Talebiniz inceleniyor.</b> Geleceği Yazanlar ekibimiz CV talebinizi değerlendiriyor. Değerlendirme tamamlandığında ihtiyaçlarınıza uygun mezunlarımızın CV&apos;leri sizinle paylaşılacaktır.
              </p>
            )}
            {member.status !== 'pending' && member.status !== 'rejected' && (
              <p className="hint" style={{marginTop: 8}}>Erişim için Geleceği Yazanlar Akademi ekibiyle iletişime geçin.</p>
            )}
            {loading && <p className="muted">Talepler yükleniyor…</p>}
            {!loading && !requests.length && <div className="empty">Henüz CV talebiniz yok.</div>}
            {!loading && !!requests.length && (
              <div className="req-cards">
                {requests.map((r) => (
                  <article key={r.id} className="req-card">
                    <div className="req-card-head">
                      <time dateTime={r.created_at}>{date(r.created_at)}</time>
                      <span className={'status ' + (statusClass[r.status] || 'hidden')}>{statusLabel[r.status] || r.status}</span>
                    </div>
                    <div className="items">
                      {r.items.map((i) => {
                        const l = itemLabel(labels, i);
                        return <div key={i.programId + i.areaId}><span>{l.program} › <b>{l.area}</b></span><span className="quota-badge">Kontenjan: {i.quota}</span></div>;
                      })}
                      {r.other_label && <div><span>Diğer › <b>{r.other_label}</b></span><span className="quota-badge">Kontenjan: {r.other_quota}</span></div>}
                    </div>
                    {!!r.work_models?.length && <p className="hint" style={{marginTop: 8}}>Çalışma modeli: <b>{formatWorkModels(r.work_models)}</b></p>}
                    {r.note && <p className="hint" style={{marginTop: 4}}>Not: {r.note}</p>}
                  </article>
                ))}
              </div>
            )}
            {error && <p className="alert error" role="alert">{error}</p>}
            <div className="toolbar" style={{marginTop: 8}}>
              <Button className="navy" disabled={loading} onClick={openForm}><Plus size={16} />Yeni CV Talebi Oluştur</Button>
              <LogoutButton />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
