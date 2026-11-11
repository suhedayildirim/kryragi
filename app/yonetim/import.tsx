'use client';
import {useState} from 'react';
import {Upload, Download, Check, ChevronRight} from 'lucide-react';
import {Button, PageTitle, saveFile} from '../components/ui';
import {excelFields, readExcelRow, normalize, cleanProfile} from '../../lib/model';
import type {AdminCtx} from './admin-app';

export function ImportTab({ctx}: {ctx: AdminCtx}) {
  const {data} = ctx;
  const programs = data.catalog.map((p) => p.name);
  const [rows, setRows] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState('');
  const [defaultProgram, setDefaultProgram] = useState(programs[0] || '');
  const [mode, setMode] = useState('add');

  async function parseExcel(f: File) {
    setRows([]); setErrors([]); setInfo('Dosya okunuyor…');
    try {
      if (f.size > 5 * 1024 * 1024) throw new Error('Dosya en fazla 5 MB olabilir.');
      if (!/\.xlsx$/i.test(f.name)) throw new Error('Lütfen .xlsx biçiminde bir Excel dosyası seçin.');
      const E: any = await import('exceljs');
      const wb = new (E.default || E).Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const sh = wb.worksheets[0];
      if (!sh) throw new Error('Dosyada çalışma sayfası yok.');
      if (sh.rowCount > 501) throw new Error('Bir seferde en fazla 500 mezun yükleyin.');
      const cell = (v: any): string => v?.hyperlink || v?.text || (v?.richText ? v.richText.map((x: any) => x.text).join('') : v?.result !== undefined ? String(v.result) : String(v ?? ''));
      const headers: any = {};
      sh.getRow(1).eachCell((c: any, n: number) => { headers[normalize(cell(c.value))] = n; });
      if (!headers[normalize('Ad-Soyad')] || !headers[normalize('E-Mail')]) throw new Error('Ad-Soyad ve E-Mail sütunları bulunamadı. Şablonu kullanın.');
      const parsed: any[] = []; const errs: string[] = []; const seen = new Set();
      sh.eachRow((r: any, n: number) => {
        if (n === 1) return;
        const p: any = readExcelRow(headers, (col) => cell(r.getCell(col).value));
        if (!Object.values(p).some(Boolean)) return;
        p.program = p.program || defaultProgram;
        p.skills = p.skills || p.classGroup;
        try {
          const c = cleanProfile(p);
          if (seen.has(c.email)) throw new Error('Dosyada mükerrer e-posta');
          seen.add(c.email);
          const existing = data.profiles.find((g) => g.email === c.email);
          parsed.push({...c, _preservePeriod: !headers[normalize('GYGY Mezun Dönemi')], _row: n, _existing: !!existing});
        } catch (e: any) { errs.push('Satır ' + n + ': ' + e.message); }
      });
      setRows(parsed); setErrors(errs); setInfo(f.name + ' • ' + parsed.length + ' geçerli satır • ' + errs.length + ' hata');
    } catch (e: any) { setErrors([e.message]); setInfo('Dosya okunamadı.'); }
  }
  async function template() {
    const E: any = await import('exceljs');
    const w = new (E.default || E).Workbook();
    const s = w.addWorksheet('Mezunlar');
    s.addRow(excelFields.map((x) => x[1]));
    const sample: any = {name: 'Örnek Mezun', email: 'ornek@example.com', classGroup: 'Java', program: defaultProgram, city: 'İstanbul', university: 'Örnek Üniversitesi', department: 'Bilgisayar Mühendisliği', year: '2025', gpa: '3,20 / 4', work: 'İş arıyor'};
    s.addRow(excelFields.map(([k]) => sample[k] || ''));
    s.columns.forEach((c: any) => { c.width = 27; });
    s.getRow(1).font = {bold: true};
    saveFile(new Blob([await w.xlsx.writeBuffer()]), 'GY_Mezun_Yukleme_Sablonu.xlsx');
  }
  async function importRows() {
    const send = rows.filter((r) => mode === 'update' || !r._existing);
    const d = await ctx.act({action: 'import', rows: send}, '');
    if (d) { setRows([]); setInfo(d.count + ' kayıt incelemeye alındı.'); ctx.setNotice(d.count + ' kayıt incelemeye alındı.'); }
  }
  const sendCount = rows.filter((r) => mode === 'update' || !r._existing).length;

  return <>
    <PageTitle title="Toplu mezun yükleme" desc="Excel dosyanızı kontrol edin, mükerrer kayıtları görün ve güvenle aktarın." />
    <div className="steps"><b>01 <span>Dosyayı seç</span></b><ChevronRight /><b>02 <span>Önizlemeyi kontrol et</span></b><ChevronRight /><b>03 <span>İncelemeye aktar</span></b></div>
    <div className="split">
      <section className="panel">
        <h3>Yükleme ayarları</h3>
        <label className="field">Programı boş olan satırlar için<select value={defaultProgram} onChange={(e) => setDefaultProgram(e.target.value)}>{programs.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="field">Mükerrer e-posta bulunduğunda<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="add">Mevcut kayıtları atla</option><option value="update">Mevcut kaydı güncelle ve yeniden incelemeye al</option></select></label>
        <p className="hint">GY Mezun Programı boşsa seçtiğiniz program kullanılır. Alan (Bootcamp Sınıfı), firma yetkilerindeki alan adlarıyla aynı yazılmalıdır.</p>
        <Button secondary onClick={template}><Download size={16} />Excel şablonunu indir</Button>
      </section>
      <label className="dropzone"><Upload size={36} /><h3>Excel dosyanızı seçin</h3><p>.xlsx · En fazla 500 satır · 5 MB</p><span className="btn primary">Dosya seç</span><input type="file" accept=".xlsx" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) parseExcel(f); }} /></label>
    </div>
    {info && <p className="importinfo">{info}</p>}
    {errors.length > 0 && <div className="alert error"><div>{errors.slice(0, 10).map((e) => <p key={e}>{e}</p>)}<p>Hatalı satırlar atlanır.</p></div></div>}
    {rows.length > 0 && <>
      <div className="tablewrap"><table><thead><tr><th>Satır</th><th>Ad-soyad</th><th>E-posta</th><th>Alan</th><th>Program</th><th>Şehir</th><th>İşlem</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r._row}><td>{r._row}</td><td>{r.name}</td><td>{r.email}</td><td>{r.classGroup}</td><td>{r.program}</td><td>{r.city || '—'}</td><td>{r._existing ? mode === 'add' ? 'Atlanacak' : 'Güncellenecek' : 'Yeni kayıt'}</td></tr>)}
      </tbody></table></div>
      <div className="toolbar"><Button disabled={ctx.busy || !sendCount} onClick={importRows}><Check size={17} />{sendCount} kaydı incelemeye al</Button><p className="hint">Kayıtlar otomatik yayımlanmaz.</p></div>
    </>}
    <div className="panel mapping"><h3>Excel alan eşleştirmesi</h3><div className="fieldmap">{excelFields.map(([k, v]) => <span key={k}><Check size={13} />{v}</span>)}</div><p className="hint">İlk satır bu 15 sütun başlığını içermelidir. Eski şablonlardaki Program ve GYGY Mezun Dönemi başlıkları da desteklenir.</p></div>
  </>;
}
