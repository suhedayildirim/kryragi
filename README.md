# GY Kariyer Ağı

Geleceği Yazanlar mezunlarının CV'lerini firmalarla kontrollü biçimde paylaşan Next.js uygulaması. Harici bir kimlik veya bulut servisine bağlı değildir; yerel bilgisayarda ya da kendi sunucunuzda çalışır.

## Gereksinimler

- Node.js **22.13 veya üzeri** (yerleşik `node:sqlite` modülü kullanılır)

## Kurulum ve çalıştırma

```bash
npm install
cp .env.example .env     # ADMIN_EMAIL / ADMIN_PASSWORD değerlerini değiştirin
npm run dev              # http://localhost:3000
```

- İlk istekte `data/app.db` (SQLite) oluşturulur ve `migrations/*.sql` dosyaları sırayla uygulanır.
- `.env` dosyasındaki bilgilerle yönetici hesabı oluşturulur. Bu yalnızca hiç yönetici yoksa yapılır.
- Yüklenen CV ve logo dosyaları `data/uploads/` klasöründe tutulur.

Üretim ortamında çalıştırmak için:

```bash
npm run build && npm start
```

Diğer komutlar:

- `npm test`: erişim ve iş akışı testleri
- `npm run lint`
- `npm run typecheck`

### Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `APP_URL` | Dışarıdan erişilen adres. QR bağlantısı `APP_URL/talep` olarak üretilir. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | İlk yönetici hesabı |
| `DATA_DIR` | Veritabanı ve yüklenen dosyaların klasörü (varsayılan `./data`) |

Yedekleme için `data/` klasörünü kopyalamak yeterlidir.

## Sayfalar

| Adres | Kim | Açıklama |
|---|---|---|
| `/talep` | Herkes (QR) | Firma talep formu: e-posta, firma ve iletişim bilgileri, şifre, Program › Alan seçimi ve her alan için kontenjan |
| `/giris` | Firma / yönetici | E-posta ve şifreyle giriş |
| `/yonetim` | Yalnızca yönetici | Yönetim paneli. Firma kullanıcıları sunucu tarafında `/firma` adresine yönlendirilir. |
| `/firma` | Onaylı firma | Adaylarım, İşe alım süreçlerim, Yetkili programlarım |

## İş akışı

1. **Talep.** Firma QR bağlantısıyla `/talep` formunu doldurur. Hesap "onay bekliyor" durumunda açılır, yönetim paneline bildirim düşer.
2. **Onay.** Yönetici *Firma talepleri* ekranında firma bilgilerini ve talep edilen kontenjanları görür. Talebi onaylarken açılacak alanları ve erişim bitiş tarihini belirler.
3. **CV atama.** Program yetkisi tek başına hiçbir CV göstermez. Yönetici *Yetkiler ve CV* penceresinden program ve alana göre filtrelenen yayındaki mezunları tek tek ya da toplu olarak firmaya açar. Gerekirse filtre dışından doğrudan CV de açabilir.
4. **Firma paneli.** Firma yalnızca kendisine açılan CV'leri görür. Listelerde telefon ve e-posta gösterilmez.
5. **İşe alım.** Firma bir adayda *Talebe geçildi — işe alım sürecine ekle* düğmesine basar.
   - Kayıt firmanın *İşe alım süreçlerim* sayfasında **Onay bekliyor** olarak görünür.
   - Yönetime, talep eden yetkilinin e-postasıyla birlikte bildirim düşer.
   - Yönetici onaylayınca öğrencinin e-postası firmaya açılır ve firma aşamaları (Görüşme, Teklif, İşe başladı…) ilerletir.
6. **Ek talep.** Firma panelinden yeni program veya alan talep edebilir. Bu talep de yönetime bildirim olarak düşer.

Bildirimler yalnızca panel içinde gösterilir; e-posta gönderilmez. Panel açıkken 30 saniyede bir yenilenir.

## Güvenlik notları

- **Parolalar:** PBKDF2-SHA256 (210.000 tur) ile saklanır.
- **Oturum:** `HttpOnly`, `SameSite=Lax` çerezinde tutulur. Sunucu tarafında yalnızca token'ın SHA-256 özeti saklanır.
- **Erişim kontrolü:** Tüm yetki kontrolleri sunucu tarafında yapılır.
  - Yönetim API'leri (`/api/admin`, `/api/notifications`) firma oturumuna 403 döner.
  - CV indirme ve profil detayı her istekte atama, yayın durumu, firma durumu ve erişim süresi açısından yeniden kontrol edilir.
- **İstek güvenliği:**
  - Yazma isteklerinde `Origin` kontrolü yapılır.
  - Girişte deneme sınırı vardır: IP ve e-posta başına 15 dakikada 5 deneme.
  - Talep formunda IP başına saatte 5 talep sınırı ve bot tuzağı alanı vardır.
- **Şifre sıfırlama:** E-posta altyapısı olmadığı için şifre sıfırlamayı yönetici yapar (*Firmalar ve yetkiler › Şifre*).
- **HTTPS:** İnternete açarken uygulamayı HTTPS arkasında çalıştırın (ör. reverse proxy). Bu durumda çerezler `Secure` olarak işaretlenir.

## Dizin yapısı

```
app/
  talep/       herkese açık talep formu (QR)
  giris/       giriş
  yonetim/     yönetim paneli (yalnızca admin)
  firma/       firma paneli
  components/  ortak arayüz bileşenleri
  api/         auth, public, admin, company, notifications, cv, logo
lib/
  db.ts        node:sqlite adaptörü ve migration çalıştırıcı
  storage.ts   yerel dosya deposu
  auth.ts      parola özeti ve oturum anahtarları
  server.ts    kimlik, yetki, bildirim, istek sınırı yardımcıları
  model.ts     mezun alanları, Excel eşleştirme, işe alım aşamaları
migrations/    SQL şema dosyaları
tests/         erişim ve iş akışı testleri
```
