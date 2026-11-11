'use client';
import {useState} from 'react';
import {Plus, Save, Trash2} from 'lucide-react';
import {Button, PageTitle} from '../components/ui';
import {matchesGrant} from '../../lib/model';
import type {AdminCtx} from './admin-app';

function Row({ctx, item, kind, programId, info}: {ctx: AdminCtx; item: any; kind: 'program' | 'area'; programId?: string; info: string}) {
  const [f, setF] = useState({name: item.name, sort: item.sort, active: item.active});
  const dirty = f.name !== item.name || Number(f.sort) !== item.sort || f.active !== item.active;
  return (
    <div className={'progrow ' + kind + (f.active ? '' : ' inactive')}>
      <input aria-label="Ad" value={f.name} onChange={(e) => setF({...f, name: e.target.value})} />
      <input aria-label="Sıra" type="number" className="sort" value={f.sort} onChange={(e) => setF({...f, sort: Number(e.target.value)})} />
      <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({...f, active: e.target.checked})} />Aktif</label>
      <span className="muted">{info}</span>
      <button className="textbtn" disabled={!dirty || ctx.busy} onClick={() => ctx.act({action: kind + '-save', id: item.id, programId, ...f}, 'Kaydedildi.')}><Save size={14} />Kaydet</button>
      <button className="textbtn danger" disabled={ctx.busy} aria-label="Sil" onClick={() => { if (confirm('"' + item.name + '" silinsin mi?' + (kind === 'program' ? ' Programın tüm alanları da silinir.' : ''))) ctx.act({action: kind + '-delete', id: item.id}, 'Silindi.'); }}><Trash2 size={14} /></button>
    </div>
  );
}

function AddForm({ctx, kind, programId, placeholder}: {ctx: AdminCtx; kind: 'program' | 'area'; programId?: string; placeholder: string}) {
  const [name, setName] = useState('');
  return (
    <form className="inlineform" onSubmit={async (e) => { e.preventDefault(); const d = await ctx.act({action: kind + '-save', name, programId, sort: 99, active: true}, 'Eklendi.'); if (d) setName(''); }}>
      <input required placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} />
      <Button secondary disabled={ctx.busy}><Plus size={15} />Ekle</Button>
    </form>
  );
}

// Program > Alan menüsü. QR talep formu ve firma paneli bu menüyü kullanır.
export function ProgramsTab({ctx}: {ctx: AdminCtx}) {
  const {data} = ctx;
  const published = data.profiles.filter((p) => p.status === 'published');
  const grantCount = (key: 'program_id' | 'area_id', id: string) => data.grants.filter((g) => g[key] === id).length;
  return <>
    <PageTitle title="Programlar ve alanlar" desc="Talep formunda ve firma panelinde görünen Program › Alan menüsünü yönetin. Pasif kayıtlar yeni taleplerde görünmez." />
    <p className="hint">Mezunlar, kayıtlarındaki <b>Program</b> ve <b>Bootcamp Sınıfı</b> değerleriyle buradaki adlar üzerinden eşleştirilir. Ad değiştirirseniz mezun kayıtlarını da güncelleyin.</p>
    {data.catalog.map((p) => (
      <section className="panel progpanel" key={p.id + p.name + p.sort + p.active}>
        <Row ctx={ctx} item={p} kind="program" info={published.filter((g) => matchesGrant(g, p.name, '')).length + ' yayındaki mezun · ' + grantCount('program_id', p.id) + ' firma yetkisi'} />
        <div className="arealist">
          {p.areas.map((a: any) => <Row key={a.id + a.name + a.sort + a.active} ctx={ctx} item={a} kind="area" programId={p.id} info={published.filter((g) => matchesGrant(g, p.name, a.name)).length + ' mezun · ' + grantCount('area_id', a.id) + ' yetki'} />)}
          <AddForm ctx={ctx} kind="area" programId={p.id} placeholder="Yeni alan (ör. Java Frontend)" />
        </div>
      </section>
    ))}
    <section className="panel"><h3>Yeni program</h3><AddForm ctx={ctx} kind="program" placeholder="Program adı" /></section>
  </>;
}
