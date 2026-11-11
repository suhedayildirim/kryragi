'use client';
import {useState} from 'react';
import {ArrowRight, Building2} from 'lucide-react';
import {Brand, Button, Input} from '../components/ui';
export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: f.get('email'), password: f.get('password')})});
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.assign(d.redirect);
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı.');
      setBusy(false);
    }
  }
  return (
    <div className="authpage">
      <aside className="authside"><Brand /><h1>Bir sonraki ekip arkadaşınız <em>burada olabilir.</em></h1><p>Geleceği Yazanlar mezunlarıyla tanışın. Akademinin sizin için açtığı CV’leri inceleyin, işe alım süreçlerinizi tek yerden takip edin.</p></aside>
      <main className="authmain">
        <form className="authcard" onSubmit={submit}>
          <div className="eyebrow">GY KARİYER AĞI</div>
          <h2>Giriş yap</h2>
          <p className="muted">Firma yetkilileri ve Akademi yönetimi için.</p>
          {error && <p className="alert error" role="alert">{error}</p>}
          <Input label="E-posta" name="email" type="email" required autoComplete="username" />
          <Input label="Şifre" name="password" type="password" required autoComplete="current-password" />
          <Button disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'} <ArrowRight size={16} /></Button>
          <div className="authalt"><Building2 size={18} /><span>Henüz hesabınız yok mu? <a href="/talep">Mezun CV talebi oluşturun</a></span></div>
        </form>
      </main>
    </div>
  );
}
