export const fields=[['name','Ad-Soyad'],['phone','Telefon No'],['email','E-Mail'],['classGroup','Bootcamp Sınıfı'],['period','GYGY Mezun Dönemi'],['city','Yaşadığınız Şehir'],['university','Mezun Olunan Üniversite'],['department','Üniversite Bölümü'],['year','Mezuniyet Senesi'],['gpa','Mezuniyet Ortalaması'],['work','Çalışma Durumu'],['employer','Çalışılan Firma/Kurum'],['github','GitHub Adresi'],['linkedin','Linkedin Adresi'],['cvSource','CV Yükleme'],['program','Program'],['skills','Teknoloji Alanları']] as const;
export const excelFields=[...fields.slice(0,4),['program','GY Mezun Programı'],...fields.slice(5,15)] as const;
export function readExcelRow(headers:Record<string,number>,read:(column:number)=>string){const p:any={};for(const [key,label] of fields){const names=key==='program'?['GY Mezun Programı','Program']:[label];const col=names.map(n=>headers[normalize(n)]).find(Boolean);if(col)p[key]=read(col).trim();}return p;}

export const awards=[{title:'İstihdama Destek',desc:'En çok mezunu işe alan firma',icon:'trophy'},{title:'Kadın İstihdamı',desc:'Teknoloji rollerinde kadın istihdamı',icon:'users'},{title:'Sürdürülebilir İstihdam',desc:'3 ay ve üzeri devamlılık oranı',icon:'sprout'},{title:'İlk Kariyer Fırsatı',desc:'İlk işine başlayan mezun sayısı',icon:'star'}];

// CV taleplerinde tercih edilen çalışma modelleri.
export const WORK_MODELS = [['uzaktan', 'Uzaktan'], ['hibrit', 'Hibrit'], ['ofisten', 'Ofisten']] as const;
export type WorkModelId = (typeof WORK_MODELS)[number][0];
export function parseWorkModels(raw: unknown): WorkModelId[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  const allowed = new Set(WORK_MODELS.map(([id]) => id));
  return WORK_MODELS.map(([id]) => id).filter((id) => list.includes(id) && allowed.has(id));
}
export function formatWorkModels(raw: unknown) {
  const selected = new Set(parseWorkModels(raw));
  return WORK_MODELS.filter(([id]) => selected.has(id)).map(([, label]) => label).join(', ');
}
export function normalize(s:any){return String(s??'').trim().toLocaleLowerCase('tr-TR');}
export function cleanProfile(p:any){const o:any={};for(const [k] of fields)o[k]=String(p[k]??'').trim().slice(0,1500);o.email=o.email.toLowerCase();if(!o.name||!/^\S+@\S+\.\S+$/.test(o.email))throw new Error('Ad-soyad ve geçerli e-posta zorunludur.');for(const k of ['github','linkedin','cvSource'])if(o[k]&&!/^https:\/\//i.test(o[k]))throw new Error('Bağlantılar https:// ile başlamalıdır.');return o;}
// İşe alım aşamaları. 'Onay bekliyor' firmanın talebidir, admin onaylayınca 'İnceleniyor' ile başlar.
export const PENDING_STAGE='Onay bekliyor';
export const REJECTED_STAGE='Reddedildi';
export const stages=['İnceleniyor','Görüşme','Teklif','İşe başladı','Kapandı'];
export const allStages=[PENDING_STAGE,...stages,REJECTED_STAGE];
// Mezunun programı/alanı ile menüdeki program/alanı eşleştirir.
export function matchesGrant(profile:any,programName:string,areaName:string){return normalize(profile.program)===normalize(programName)&&(!areaName||normalize(profile.classGroup)===normalize(areaName));}
// Talep/yetki kalemini "Program › Alan" etiketine çevirir.
export function itemLabel(catalog: {id: string; name: string; areas: {id: string; name: string}[]}[], item: {programId?: string; areaId?: string; program_id?: string; area_id?: string}) {
  const pid = item.programId ?? item.program_id;
  const aid = item.areaId ?? item.area_id;
  const p = catalog.find((x) => x.id === pid);
  const a = p?.areas.find((x) => x.id === aid);
  return {program: p?.name || 'Silinmiş program', area: a?.name || (aid ? 'Silinmiş alan' : 'Tüm program')};
}


// ---- Firma takibi (yalnızca admin görür) ----
export const followStatuses: [string, string][] = [['bekliyor', 'Bekliyor'], ['iletisime_gecildi', 'İletişime geçildi'], ['gorusme_planlandi', 'Görüşme planlandı'], ['surec_devam', 'Süreç devam ediyor'], ['tamamlandi', 'Tamamlandı'], ['yanit_yok', 'Yanıt yok']];
export const followChannels: [string, string][] = [['telefon', 'Telefon'], ['e-posta', 'E-posta'], ['toplanti', 'Toplantı'], ['diger', 'Diğer']];
export const followLabel = (s: string) => followStatuses.find((x) => x[0] === s)?.[1] || 'Bekliyor';
export const channelLabel = (s: string) => followChannels.find((x) => x[0] === s)?.[1] || '';
// Takip gerekiyor: sonraki takip tarihi geldiyse/geçtiyse ya da onaydan bu yana `days` günden fazla süredir hiç işlem yapılmadıysa.
export function needsFollowUp(m: any, days: number, today = new Date().toISOString().slice(0, 10)) {
  if (m.status !== 'approved') return false;
  if (m.next_follow_up && m.next_follow_up <= today) return true;
  if ((m.follow_status || 'bekliyor') !== 'bekliyor' || !m.approved_at) return false;
  return (Date.parse(today) - Date.parse(String(m.approved_at).slice(0, 10))) / 864e5 > days;
}
