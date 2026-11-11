// Erişim ve iş akışı testleri: gerçek migration'lar, gerçek SQLite adaptörü, gerçek route dosyaları.
// Çalıştırma: npm test
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

function load(file, vars) {
  const source = fs.readFileSync(file, 'utf8').replace(/^import .*;$/gm, '');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const ex = {};
  new Function('exports', ...Object.keys(vars), compiled)(ex, ...Object.values(vars));
  return ex;
}

process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'admin-sifre-123';
process.env.APP_URL = 'http://localhost:3000';

const dbLib = load('lib/db.ts', {fs, path});
const sqlite = new DatabaseSync(':memory:');
dbLib.migrate(sqlite, path.resolve('migrations'));
const database = dbLib.createDatabase(sqlite);
const row = (q, ...a) => sqlite.prepare(q).get(...a);
const count = (q, ...a) => Number(sqlite.prepare(q).get(...a).n);

const files = new Map();
const store = {async put(k, v) { files.set(k, new Uint8Array(v)); }, async get(k) { return files.has(k) ? {body: files.get(k)} : null; }, async delete(k) { files.delete(k); }};

let token = null;
const auth = load('lib/auth.ts', {});
const model = load('lib/model.ts', {});
const server = load('lib/server.ts', {cookies: async () => ({get: (n) => (n === 'gy_session' && token ? {value: token} : undefined)}), getDb: () => database, storage: store, ...auth, ...model});
const vars = {...server, ...model, ...auth};
const route = (f) => load(f, vars);
const api = {
  login: route('app/api/auth/login/route.ts'), logout: route('app/api/auth/logout/route.ts'), password: route('app/api/auth/password/route.ts'),
  catalog: route('app/api/public/catalog/route.ts'), request: route('app/api/public/request/route.ts'),
  admin: route('app/api/admin/route.ts'), company: route('app/api/company/route.ts'), notifications: route('app/api/notifications/route.ts'),
  cv: route('app/api/cv/[id]/route.ts'), logo: route('app/api/logo/route.ts'),
};

const URL_BASE = 'http://localhost:3000';
let ip = 1;
function req(p, body, {origin = URL_BASE, form, newIp = false} = {}) {
  const headers = {Origin: origin, 'x-forwarded-for': newIp ? '10.0.0.' + ip++ : '10.0.0.1'};
  if (token) headers.Cookie = 'gy_session=' + token;
  if (form) return new Request(URL_BASE + p, {method: 'POST', headers, body: form});
  if (body === undefined) return new Request(URL_BASE + p, {headers});
  headers['Content-Type'] = 'application/json';
  return new Request(URL_BASE + p, {method: 'POST', headers, body: JSON.stringify(body)});
}
async function login(email, password) {
  token = null;
  const r = await api.login.POST(req('/api/auth/login', {email, password}, {newIp: true}));
  if (r.status === 200) token = /gy_session=([^;]+)/.exec(r.headers.get('set-cookie'))[1];
  return r;
}
const admin = (b) => api.admin.POST(req('/api/admin', b));
const company = (b) => api.company.POST(req('/api/company', b));
const body = async (r) => r.json();

// ---- Kimlik doğrulama ----
token = null;
assert.equal((await api.admin.GET(req('/api/admin'))).status, 401);
assert.equal((await api.company.GET()).status, 401);
assert.equal((await login('admin@example.com', 'yanlis-sifre')).status, 401);
let r = await login('admin@example.com', 'admin-sifre-123');
assert.equal(r.status, 200);
assert.equal((await body(r)).redirect, '/yonetim');
assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
assert.equal(count("SELECT COUNT(*) AS n FROM users WHERE role='admin'"), 1);
assert.ok(row('SELECT password_hash FROM users').password_hash.startsWith('pbkdf2$'));
assert.equal((await api.admin.GET(req('/api/admin'))).status, 200);
assert.equal((await admin({action: 'program-save', name: 'X'}).then(() => api.admin.POST(req('/api/admin', {action: 'program-save', name: 'Y'}, {origin: 'https://evil.test'})))).status, 403);
sqlite.exec("DELETE FROM programs WHERE name IN ('X','Y')");
for (let i = 0; i < 5; i++) await api.login.POST(req('/api/auth/login', {email: 'brute@example.com', password: 'x'}));
assert.equal((await api.login.POST(req('/api/auth/login', {email: 'brute@example.com', password: 'x'}))).status, 429);
console.log('PASS: oturum çerezi, admin seed, hatalı şifre, CSRF kaynağı, kaba kuvvet sınırı.');

// ---- QR talep formu ----
const catalog = await body(await api.catalog.GET());
assert.equal(catalog.programs.length, 3);
const gygy = catalog.programs.find((p) => p.id === 'p-gygy');
const java = gygy.areas.find((a) => a.name === 'Java');
const fe = gygy.areas.find((a) => a.name === 'Front-End');
const form = {company: 'Test Yazılım A.Ş.', name: 'Ayşe Yetkili', title: 'İK Müdürü', email: 'ik@testfirma.com', phone: '0555 111 22 33', website: 'https://testfirma.com', city: 'İstanbul', password: 'firma-sifre-1', password2: 'firma-sifre-1', terms: true, items: [{programId: gygy.id, areaId: java.id, quota: 7}, {programId: gygy.id, areaId: fe.id, quota: 2}], note: 'Junior Java', workModels: ['uzaktan', 'hibrit']};
token = null;
assert.equal((await api.request.POST(req('/api/public/request', {...form, items: []}, {newIp: true}))).status, 400);
assert.equal((await api.request.POST(req('/api/public/request', {...form, items: [], other: {enabled: true, label: '', quota: 3}}, {newIp: true}))).status, 400);
assert.equal((await api.request.POST(req('/api/public/request', {...form, items: [{programId: gygy.id, areaId: '', quota: 1}]}, {newIp: true}))).status, 400);
assert.equal((await api.request.POST(req('/api/public/request', {...form, workModels: []}, {newIp: true}))).status, 400);
assert.equal((await api.request.POST(req('/api/public/request', {...form, terms: false}, {newIp: true}))).status, 400);
assert.equal((await api.request.POST(req('/api/public/request', form, {origin: 'https://evil.test', newIp: true}))).status, 403);
r = await api.request.POST(req('/api/public/request', {...form, other: {enabled: true, label: 'DevOps', quota: 4}}, {newIp: true}));
assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
assert.equal((await api.request.POST(req('/api/public/request', form, {newIp: true}))).status, 409);
const member = row('SELECT * FROM members WHERE email = ?', 'ik@testfirma.com');
assert.equal(member.status, 'pending');
assert.equal(member.phone, '0555 111 22 33');
const request = row('SELECT * FROM access_requests WHERE member_id = ?', member.id);
assert.deepEqual(JSON.parse(request.items).map((i) => i.quota), [7, 2]);
assert.equal(request.other_label, 'DevOps');
assert.equal(request.other_quota, 4);
assert.deepEqual(JSON.parse(request.work_models), ['uzaktan', 'hibrit']);
const notif = row("SELECT * FROM notifications WHERE type='access_request'");
assert.equal(notif.actor_email, 'ik@testfirma.com');
assert.match(notif.body, /Java \(kontenjan 7\)/);
assert.match(notif.body, /Diğer › DevOps \(kontenjan 4\)/);
assert.match(notif.body, /Çalışma modeli: Uzaktan, Hibrit/);
// Yalnızca diğer teknoloji alanı ile başvuru
r = await api.request.POST(req('/api/public/request', {...form, email: 'diger@testfirma.com', items: [], other: {enabled: true, label: 'İş Analistliği', quota: 2}, workModels: ['ofisten']}, {newIp: true}));
assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
const otherOnly = row('SELECT * FROM access_requests WHERE member_id = (SELECT id FROM members WHERE email = ?)', 'diger@testfirma.com');
assert.deepEqual(JSON.parse(otherOnly.items), []);
assert.equal(otherOnly.other_label, 'İş Analistliği');
assert.equal(otherOnly.other_quota, 2);
assert.deepEqual(JSON.parse(otherOnly.work_models), ['ofisten']);
console.log('PASS: herkese açık talep formu doğrulaması, kontenjan, diğer alan, çalışma modeli, mükerrer e-posta, yönetime bildirim.');

// Diğer-only başvuruyu reddet (sonraki bildirim sayaçlarını bozmasın)
await login('admin@example.com', 'admin-sifre-123');
assert.equal((await admin({action: 'request-reject', id: otherOnly.id, note: 'test'})).status, 200);

// ---- Onay öncesi firma yalnızca CV taleplerini görür / yeni talep açabilir; yönetim paneline erişemez ----
assert.equal((await login('ik@testfirma.com', 'firma-sifre-1')).status, 200);
r = await api.company.GET();
assert.equal(r.status, 200);
let pendingGate = await body(r);
assert.equal(pendingGate.gate, 'requests');
assert.equal(pendingGate.profiles, undefined);
assert.equal(pendingGate.requests.length, 1);
assert.equal(pendingGate.requests[0].other_label, 'DevOps');
assert.equal((await company({action: 'hire', candidate: 'x'})).status, 403);
assert.equal((await company({action: 'detail', id: 'x'})).status, 403);
// Pending firma ikinci CV talebi (önceki silinmez)
assert.equal((await company({action: 'cv-request', company: 'Test Yazılım A.Ş.', name: 'Ayşe Yetkili', title: 'İK Müdürü', phone: '0555 111 22 33', items: [{programId: 'p-siber', areaId: 'a-siber-sg', quota: 2}], other: {enabled: true, label: 'Bulut', quota: 1}, note: 'Ek talep', workModels: []})).status, 400);
r = await company({action: 'cv-request', company: 'Test Yazılım A.Ş.', name: 'Ayşe Yetkili', title: 'İK Müdürü', phone: '0555 111 22 33', items: [{programId: 'p-siber', areaId: 'a-siber-sg', quota: 2}], other: {enabled: true, label: 'Bulut', quota: 1}, note: 'Ek talep', workModels: ['hibrit', 'ofisten']});
assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
assert.equal(count('SELECT COUNT(*) AS n FROM access_requests WHERE member_id = ?', member.id), 2);
const secondReq = row("SELECT * FROM access_requests WHERE member_id = ? AND type = 'program'", member.id);
assert.equal(secondReq.status, 'pending');
assert.equal(secondReq.other_label, 'Bulut');
assert.deepEqual(JSON.parse(secondReq.work_models), ['hibrit', 'ofisten']);
assert.equal(row('SELECT * FROM access_requests WHERE id = ?', request.id).status, 'pending'); // ilk talep aynı
assert.deepEqual(JSON.parse(row('SELECT * FROM access_requests WHERE id = ?', request.id).work_models), ['uzaktan', 'hibrit']);
assert.equal(row('SELECT status FROM members WHERE id = ?', member.id).status, 'pending');
assert.equal((await api.admin.GET(req('/api/admin'))).status, 403);
assert.equal((await admin({action: 'request-approve', id: request.id, items: JSON.parse(request.items), expires: '2099-01-01'})).status, 403);
assert.equal((await api.notifications.GET(req('/api/notifications'))).status, 403);

// ---- Admin: mezun ekle, talebi onayla ----
await login('admin@example.com', 'admin-sifre-123');
assert.equal((await admin({action: 'request-reject', id: secondReq.id, note: 'test-cleanup'})).status, 200);
const mk = async (p) => (await body(await admin({action: 'profile', profile: {status: 'published', evidence: 'Form v1', city: 'İzmir', skills: 'Java, Spring', ...p}}))).id;
const javaGrad = await mk({name: 'Java Mezun', email: 'java@example.com', program: gygy.name, classGroup: 'Java', phone: '0500'});
const feGrad = await mk({name: 'FE Mezun', email: 'fe@example.com', program: gygy.name, classGroup: 'Front-End'});
const otherGrad = await mk({name: 'Siber Mezun', email: 'siber@example.com', program: 'Siber Güvenliğin Süper Kadınları', classGroup: 'Siber Güvenlik'});
const pendingGrad = await mk({name: 'Bekleyen', email: 'bekleyen@example.com', program: gygy.name, classGroup: 'Java', status: 'pending', evidence: ''});
r = await admin({action: 'request-approve', id: request.id, items: [{programId: gygy.id, areaId: java.id, quota: 7}], expires: '2099-01-01'});
assert.equal(r.status, 200);
assert.equal(row('SELECT status FROM members WHERE id = ?', member.id).status, 'approved');
assert.equal(count('SELECT COUNT(*) AS n FROM member_grants WHERE member_id = ?', member.id), 1);
assert.equal((await admin({action: 'request-approve', id: request.id, items: [{programId: gygy.id, areaId: java.id, quota: 7}], expires: '2099-01-01'})).status, 400);
const grant = row('SELECT * FROM member_grants WHERE member_id = ?', member.id);

// Program yetkisi CV göstermez: firma yalnızca atanmış CV'leri görür.
await login('ik@testfirma.com', 'firma-sifre-1');
let data = await body(await api.company.GET());
assert.equal(data.profiles.length, 0);
assert.equal(data.grants[0].quota, 7);
assert.equal((await company({action: 'detail', id: javaGrad})).status, 404);
assert.equal((await api.cv.GET(req('/api/cv/' + javaGrad), {params: {id: javaGrad}})).status, 404);
assert.equal((await company({action: 'hire', candidate: javaGrad})).status, 404);
console.log('PASS: onay öncesi firma CV talepleri + ek talep, yönetim API/bildirim 403, program yetkisi tek başına CV açmaz.');

// ---- CV atama ----
await login('admin@example.com', 'admin-sifre-123');
assert.equal((await admin({action: 'assign', memberId: member.id, profileIds: [pendingGrad]})).status, 400);
r = await admin({action: 'assign', memberId: member.id, profileIds: [javaGrad], grantId: grant.id});
assert.equal((await body(r)).count, 1);
r = await admin({action: 'assign', memberId: member.id, profileIds: [feGrad]});
assert.equal((await body(r)).count, 1);
const pdf = new FormData();
pdf.append('file', new File(['%PDF-1.7\nTest'], 'cv.pdf', {type: 'application/pdf'}));
assert.equal((await api.cv.POST(req('/api/cv/' + javaGrad, undefined, {form: pdf}), {params: {id: javaGrad}})).status, 200);

await login('ik@testfirma.com', 'firma-sifre-1');
data = await body(await api.company.GET());
assert.deepEqual(data.profiles.map((p) => p.name).sort(), ['FE Mezun', 'Java Mezun']);
assert.ok(data.profiles.every((p) => p.email === undefined && p.phone === undefined && p.contactEmail === undefined));
r = await company({action: 'detail', id: javaGrad});
assert.equal(r.status, 200);
assert.equal((await body(r)).profile.email, undefined);
assert.equal((await company({action: 'detail', id: otherGrad})).status, 404);
r = await api.cv.GET(req('/api/cv/' + javaGrad), {params: {id: javaGrad}});
assert.equal(r.status, 200);
assert.match(r.headers.get('content-disposition'), /attachment/);
const cvForm = new FormData();
cvForm.append('file', new File(['%PDF-1.7'], 'x.pdf'));
assert.equal((await api.cv.POST(req('/api/cv/' + javaGrad, undefined, {form: cvForm}), {params: {id: javaGrad}})).status, 403);
console.log('PASS: yalnızca yayındaki mezun atanır, firma yalnızca atanan CV’leri görür, iletişim alanları gizli, PDF indirme.');

// ---- İşe alım sürecine ekle ----
r = await company({action: 'hire', candidate: javaGrad, role: 'Junior Java Developer'});
assert.equal((await body(r)).placement.stage, 'Onay bekliyor');
assert.equal((await body(await company({action: 'hire', candidate: javaGrad}))).created, false);
const placement = row('SELECT * FROM placements WHERE candidate = ?', javaGrad);
const hiringNotif = row("SELECT * FROM notifications WHERE type='hiring_request'");
assert.equal(hiringNotif.actor_email, 'ik@testfirma.com');
assert.equal(hiringNotif.ref_id, placement.id);
assert.equal((await company({action: 'stage', id: placement.id, stage: 'Görüşme'})).status, 400);
data = await body(await api.company.GET());
assert.equal(data.placements[0].stage, 'Onay bekliyor');

await login('admin@example.com', 'admin-sifre-123');
let summary = await body(await api.notifications.GET(req('/api/notifications?summary=1')));
assert.equal(summary.unread, 1); // talep onaylanınca ilk bildirim okundu sayılır
r = await api.notifications.GET(req('/api/notifications'));
assert.equal((await body(r)).notifications[0].company, 'Test Yazılım A.Ş.');
assert.equal((await admin({action: 'hiring-decide', id: placement.id, approve: true})).status, 200);
assert.equal((await body(await api.notifications.GET(req('/api/notifications?summary=1')))).unread, 0);

await login('ik@testfirma.com', 'firma-sifre-1');
data = await body(await api.company.GET());
assert.equal(data.profiles.find((p) => p.id === javaGrad).contactEmail, 'java@example.com');
assert.equal(data.profiles.find((p) => p.id === feGrad).contactEmail, undefined);
assert.equal(data.placements[0].stage, 'İnceleniyor');
assert.equal((await company({action: 'stage', id: placement.id, stage: 'Görüşme', role: 'Junior'})).status, 200);
assert.equal((await company({action: 'stage', id: placement.id, stage: 'İşe başladı'})).status, 400);
console.log('PASS: işe alım talebi Onay bekliyor + bildirim, admin onayı sonrası öğrenci e-postası açılır, aşama güncelleme.');

// ---- Ek program talebi (onaylı firma) ----
assert.equal((await company({action: 'program-request', items: [{programId: 'p-siber', areaId: 'a-siber-sg', quota: 3}], other: {enabled: true, label: 'QA', quota: 2}, note: 'Siber ekip'})).status, 400);
r = await company({action: 'program-request', items: [{programId: 'p-siber', areaId: 'a-siber-sg', quota: 3}], other: {enabled: true, label: 'QA', quota: 2}, note: 'Siber ekip', workModels: ['uzaktan', 'hibrit', 'ofisten']});
assert.equal(r.status, 200);
assert.equal(count("SELECT COUNT(*) AS n FROM access_requests WHERE type='program' AND status='pending'"), 1);
assert.ok(count("SELECT COUNT(*) AS n FROM notifications WHERE type='program_request'") >= 1);
const approvedProgramReq = row("SELECT * FROM access_requests WHERE member_id = ? AND type = 'program' AND status = 'pending'", member.id);
assert.equal(approvedProgramReq.other_label, 'QA');
assert.equal(approvedProgramReq.other_quota, 2);
assert.deepEqual(JSON.parse(approvedProgramReq.work_models), ['uzaktan', 'hibrit', 'ofisten']);

// ---- Başka firma izolasyonu ----
await login('admin@example.com', 'admin-sifre-123');
assert.equal((await admin({action: 'member-save', company: 'İkinci', name: 'B', email: 'b@ikinci.com', password: 'ikinci-123', status: 'approved', expires: '2099-01-01'})).status, 200);
await login('b@ikinci.com', 'ikinci-123');
assert.equal((await body(await api.company.GET())).profiles.length, 0);
assert.equal((await company({action: 'stage', id: placement.id, stage: 'Teklif'})).status, 404);
assert.equal((await company({action: 'detail', id: javaGrad})).status, 404);
console.log('PASS: ek program talebi bildirimi, firmalar arası izolasyon.');

// ---- Yetki kaldırma, askıya alma, toplu silme ----
await login('admin@example.com', 'admin-sifre-123');
r = await admin({action: 'grant-delete', id: grant.id});
assert.equal((await body(r)).removed, 1);
await login('ik@testfirma.com', 'firma-sifre-1');
assert.deepEqual((await body(await api.company.GET())).profiles.map((p) => p.name), ['FE Mezun']);
await login('admin@example.com', 'admin-sifre-123');
await admin({action: 'member-save', id: member.id, company: member.company, name: member.name, status: 'suspended', expires: '2099-01-01'});
await login('ik@testfirma.com', 'firma-sifre-1');
r = await api.company.GET();
assert.equal(r.status, 200);
assert.equal((await body(r)).gate, 'requests'); // askıdaki firma yalnızca talep ekranı
assert.equal((await company({action: 'hire', candidate: feGrad})).status, 403);
assert.equal((await api.cv.GET(req('/api/cv/' + feGrad), {params: {id: feGrad}})).status, 403);
await login('admin@example.com', 'admin-sifre-123');
assert.equal((await admin({action: 'delete-profiles', ids: [javaGrad, feGrad]})).status, 200);
assert.equal(count('SELECT COUNT(*) AS n FROM profiles WHERE id IN (?, ?)', javaGrad, feGrad), 0);
assert.equal(count('SELECT COUNT(*) AS n FROM member_profiles'), 0);
assert.equal(count('SELECT COUNT(*) AS n FROM placements'), 0);
assert.equal(count("SELECT COUNT(*) AS n FROM notifications WHERE type='hiring_request'"), 0);
assert.equal([...files.keys()].filter((k) => k.startsWith('cv/' + javaGrad)).length, 0);
assert.equal(count('SELECT COUNT(*) AS n FROM profiles'), 2);
console.log('PASS: yetki kaldırınca bağlı CV erişimi kapanır, askıdaki firma CV göremez, toplu silme bağlı kayıtları ve dosyaları temizler.');

// ---- Program menüsü ----
r = await admin({action: 'area-save', programId: 'p-gygy', name: 'Java Frontend', sort: 10});
assert.equal(r.status, 200);
assert.ok((await body(await api.catalog.GET())).programs.find((p) => p.id === 'p-gygy').areas.some((a) => a.name === 'Java Frontend'));
r = await admin({action: 'area-save', id: (await body(r)).id, programId: 'p-gygy', name: 'Java Frontend', active: false});
assert.ok(!(await body(await api.catalog.GET())).programs.find((p) => p.id === 'p-gygy').areas.some((a) => a.name === 'Java Frontend'));
console.log('PASS: program / alan menüsü yönetimi, pasif alan talep formunda görünmez.');

// ---- Şifre ve çıkış ----
assert.equal((await admin({action: 'member-password', id: member.id, password: 'yeni-firma-1'})).status, 200);
assert.equal((await login('ik@testfirma.com', 'firma-sifre-1')).status, 401);
assert.equal((await login('ik@testfirma.com', 'yeni-firma-1')).status, 200);
assert.equal((await api.password.POST(req('/api/auth/password', {current: 'yanlis', next: 'baska-sifre-1'}))).status, 400);
assert.equal((await api.password.POST(req('/api/auth/password', {current: 'yeni-firma-1', next: 'baska-sifre-1'}))).status, 200);
r = await api.logout.POST(req('/api/auth/logout', {}));
assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
assert.equal((await api.company.GET()).status, 401);
console.log('PASS: admin şifre belirleme, kullanıcı şifre değiştirme, çıkışta oturum silinir.');

// ---- Firma takibi ----
await login('admin@example.com', 'admin-sifre-123');
const second = row('SELECT * FROM members WHERE email = ?', 'b@ikinci.com');
assert.equal(second.follow_status, 'bekliyor');
assert.ok(second.approved_at);
const actCount = () => count('SELECT COUNT(*) AS n FROM firm_activities WHERE member_id = ?', second.id);
const before = actCount();
await admin({action: 'grant-save', memberId: second.id, programId: 'p-siber', areaId: 'a-siber-sg', quota: 2});
assert.equal(actCount(), before + 1); // sistem olayı geçmişe yazılır
assert.equal(row('SELECT follow_status FROM members WHERE id = ?', second.id).follow_status, 'bekliyor'); // durumu değiştirmez
assert.equal(model.needsFollowUp({...second, approved_at: '2026-01-01'}, 7, '2026-01-05'), false);
assert.equal(model.needsFollowUp({...second, approved_at: '2026-01-01'}, 7, '2026-01-10'), true);
assert.equal(model.needsFollowUp({...second, follow_status: 'iletisime_gecildi', approved_at: '2026-01-01'}, 7, '2026-01-10'), false);
assert.equal(model.needsFollowUp({...second, follow_status: 'iletisime_gecildi', next_follow_up: '2026-01-10'}, 7, '2026-01-10'), true);
assert.equal(model.needsFollowUp({...second, status: 'suspended', approved_at: '2026-01-01'}, 7, '2026-01-10'), false);
assert.equal((await admin({action: 'followup-save', id: second.id, status: 'olmayan'})).status, 400);
assert.equal((await admin({action: 'followup-save', id: second.id, status: 'iletisime_gecildi', contactedAt: '2999-01-01'})).status, 400);
r = await admin({action: 'followup-save', id: second.id, status: 'iletisime_gecildi', channel: 'telefon', note: 'Java ihtiyacı konuşuldu', nextFollowUp: '2099-02-01'});
assert.equal(r.status, 200);
const fm = row('SELECT * FROM members WHERE id = ?', second.id);
assert.equal(fm.follow_status, 'iletisime_gecildi');
assert.equal(fm.next_follow_up, '2099-02-01');
const contact = row("SELECT * FROM firm_activities WHERE member_id = ? AND kind = 'contact'", second.id);
assert.equal(contact.channel, 'telefon');
assert.equal(contact.created_by, 'admin@example.com');
data = await body(await api.admin.GET(req('/api/admin')));
assert.ok(data.activities.some((a) => a.id === contact.id));
assert.equal(data.followupDays, 7);
await login('b@ikinci.com', 'ikinci-123');
assert.equal((await company({action: 'followup-save', id: second.id, status: 'tamamlandi'})).status, 400);
assert.equal((await api.admin.POST(req('/api/admin', {action: 'followup-save', id: second.id, status: 'tamamlandi'}))).status, 403);
const cdata = await body(await api.company.GET());
assert.equal(cdata.member.follow_status, undefined);
assert.equal(cdata.activities, undefined);
console.log('PASS: firma takibi — Bekliyor başlangıcı, sistem olayı durumu değiştirmez, iletişim kaydı, takip gerekiyor kuralı, firmaya kapalı.');

// ---- Logo ----
await login('ik@testfirma.com', 'baska-sifre-1');
const logoForm = () => { const f = new FormData(); f.append('file', new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])], 'logo.png', {type: 'image/png'})); return f; };
assert.equal((await api.logo.POST(req('/api/logo', undefined, {form: logoForm()}))).status, 403);
await login('admin@example.com', 'admin-sifre-123');
assert.equal((await api.logo.POST(req('/api/logo', undefined, {form: logoForm()}))).status, 200);
r = await api.logo.GET(new Request(URL_BASE + '/api/logo'));
assert.equal(r.headers.get('content-type'), 'image/png');
console.log('PASS: logo yalnızca admin tarafından yüklenir.');

// ---- Excel şablonu ----
assert.deepEqual(model.excelFields.map((x) => x[1]), ['Ad-Soyad', 'Telefon No', 'E-Mail', 'Bootcamp Sınıfı', 'GY Mezun Programı', 'Yaşadığınız Şehir', 'Mezun Olunan Üniversite', 'Üniversite Bölümü', 'Mezuniyet Senesi', 'Mezuniyet Ortalaması', 'Çalışma Durumu', 'Çalışılan Firma/Kurum', 'GitHub Adresi', 'Linkedin Adresi', 'CV Yükleme']);
const headers = Object.fromEntries(model.excelFields.map((x, i) => [model.normalize(x[1]), i + 1]));
const values = ['Yeni Mezun', '05550000000', 'new@example.com', 'Java', 'Geleceği Yazan Kadınlar', 'İzmir', 'Üniversite', 'Bölüm', '2025', '3.5', 'İş arıyor', '', 'https://github.com/example', 'https://linkedin.com/in/example', 'https://example.com/cv.pdf'];
const mapped = model.readExcelRow(headers, (n) => values[n - 1]);
assert.equal(mapped.program, 'Geleceği Yazan Kadınlar');
assert.equal(mapped.cvSource, 'https://example.com/cv.pdf');
r = await admin({action: 'import', rows: [mapped]});
assert.equal((await body(r)).count, 1);
console.log('PASS: 15 sütunlu Excel şablonu ve içe aktarma.');
console.log('\nTüm testler başarılı.');
