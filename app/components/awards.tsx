'use client';
import {Trophy, Users, Sprout, Star} from 'lucide-react';
import {awards} from '../../lib/model';

export function AwardsTab({placements, company}: {placements: any[]; company?: string}) {
  const done = placements.filter((p) => p.stage === 'İşe başladı' && p.verified);
  const values = [done.length, done.filter((p) => p.woman).length, done.filter((p) => p.firstJob).length, done.filter((p) => p.confirmed3).length];
  return <>
    <section className="awardhero"><div className="eyebrow">TEDARİKÇİ ZİRVESİ</div><h1>Yeteneğe açılan her kapı,<br /><em>geleceğe bir katkı.</em></h1><p>Bir yıl boyunca mezun istihdamına katkı sağlayan firmalar,<br />bir sonraki Tedarikçi Zirvesi’nde dört kategoride değerlendirilecek.</p><span>Plaket ve onurlandırma</span></section>
    <div className="awardgrid">{awards.map((a, i) => { const I = [Trophy, Users, Sprout, Star][i]; return <div className="award" key={a.title}><I size={27} /><span>0{i + 1}</span><h3>{a.title}</h3><p>{a.desc}</p></div>; })}</div>
    <div className="sectiontitle"><div><h2>Doğrulanmış katkı</h2><p>{company || 'Tüm firmaların'} istihdam sonuçları</p></div><span className="pill">Admin teyidi esas alınır</span></div>
    <div className="metrics">{['Teyitli işe başlama', 'Kadın istihdamı', 'İlk kariyer fırsatı', '3 ay devam teyidi'].map((t, i) => <div key={t}><b>{values[i]}</b><span>{t}</span></div>)}</div>
    <div className="panel"><h3>Değerlendirme yaklaşımı</h3><p>CV görüntüleme ve indirme kullanım göstergesidir. Ödüllendirmede işe başlama, ilk iş deneyimi ve üç aylık devamlılık dikkate alınır. Aynı mezunun aynı firmadaki aynı işe girişi bir kez değerlendirilir.</p></div>
  </>;
}
