# Geleceği Yazanlar Kariyer Ağı — Ürün ve uygulama analizi
22 Ekim 2026

## 1. Amaç ve kapsam
GY bootcamp mezunlarını Turkcell teknoloji tedarikçilerinin işe alım ihtiyaçlarıyla buluşturmak. Tedarikçi gününde QR ile tanıtılan havuz, bir yıllık süreç boyunca aday keşfi, CV erişimi ve istihdam sonuçlarının takibinde kullanılır. Bir sonraki zirvede doğrulanmış katkılar ödüllendirilir. Ticari iş hacmi ya da satın alma avantajı taahhüt edilmez.

## 2. Giriş ve yetki akışı
QR → uygulama giriş sayfası → kimliği doğrulanmış kişi → firma erişim başvurusu / önceden tanımlı firma üyeliği → admin onayı → firma kullanım koşulları → izinli programların mezunları.
QR bir erişim anahtarı değildir. Kullanıcı rolü tarayıcıdaki seçimden alınmaz. Sunucu her profil ve CV isteğinde kimlik, üyelik, erişim son tarihi ve program kapsamını kontrol eder.

Bu sürüm Sites kimlik doğrulamasını kullanır. Giriş ChatGPT hesabı üzerinden gerçekleşir. Firma kaydındaki e-posta giriş hesabıyla eşleşir; sonrasında sabit kullanıcı kimliği üyeliğe bağlanır. Turkcell SSO / kurumsal e-posta OTP entegrasyonu bu sürümde bulunmaz. Mevcut yayın yalnızca sahibine açıktır. Firma tanımlamak yayın erişimini genişletmez.

İlk yönetici kurulumu yalnızca sahibi tarafından erişilebilen çalışma alanında bir kez yapılır. Firma paylaşımını açmadan önce ilk yönetici kurulumu tamamlanmalı ve ALLOW_OWNER_SETUP kapatılmalıdır.

## 3. Ekranlar
- Yetenek havuzu: birbiriyle birlikte çalışan metin, teknoloji, program, şehir ve çalışma durumu filtreleri. Ada / döneme göre sıralama, sonuç adedi, filtre sıfırlama, boş durum.
- Mezun kartı: ad-soyad, şehir, dönem, bootcamp sınıfı, teknoloji etiketleri, program, profil detayı ve CV indirme.
- Detay: üniversite, bölüm, yıl, ortalama, çalışma durumu, kurum, telefon, e-posta, GitHub ve LinkedIn. Firma liste yanıtına telefon/e-posta dahil edilmez.
- Mezun yönetimi: tekil ekleme, düzenleme, görünürlük, belge referansı, PDF yükleme ve silme.
- Toplu yükleme: şablon, dosya kontrolü, satır hataları, mükerrer kontrolü, önizleme ve onaylı aktarım.
- Firma yetkileri: firma / kişi / e-posta, durum, erişim bitiş tarihi ve program kapsamı.
- İşe alım takibi: İnceleniyor, Görüşme, Teklif, İşe başladı, Kapandı.
- Etki ve ödüller: doğrulanmış kayıtların göstergeleri ve dört ödül kategorisi.
- Veri ve erişim: yayın kontrolü ve son işlem kayıtları.
- Programlar ve alanlar: merkezi filtre sözlüğü.

## 4. Excel alan sözlüğü
| Kaynak sütunu | Uygulama alanı | Kural |
|---|---|---|
| # | Kaynak sıra no | Sistem kimliği değildir, aktarımda kullanılmaz |
| Ad-Soyad | name | Zorunlu |
| Telefon No | phone | Metin, baştaki sıfır / + korunmalı |
| E-Mail | email | Zorunlu, küçük harf, tekil eşleştirme |
| Bootcamp Sınıfı | classGroup | Uzmanlık sınıfı |
| GYGY Mezun Dönemi | period | Metin olarak korunur |
| Yaşadığınız Şehir | city | Boşsa varsayılan şehir atanmaz |
| Mezun Olunan Üniversite | university | Detay ekranı |
| Üniversite Bölümü | department | Detay ekranı |
| Mezuniyet Senesi | year | Detay ekranı |
| Mezuniyet Ortalaması | gpa | Ölçek ile birlikte metin, ör. 3,20 / 4 |
| Çalışma Durumu | work | Filtre ve detay |
| Çalışılan Firma/Kurum | employer | Detay ekranı |
| GitHub Adresi | github | HTTPS bağlantı |
| Linkedin Adresi | linkedin | HTTPS bağlantı |
| CV Yükleme | cvSource | Yalnızca adminin göreceği kaynak referansı |
| Program — yeni | program | Dosyada yoksa adminin yükleme programı |
| Teknoloji Alanları — yeni | skills | Virgülle ayrılmış etiketler, boşsa sınıf bilgisi |

Bir mezunun birden fazla program mezuniyeti varsa mevcut tek profil modeli ilk aşamada ana programı tutar. Birden fazla mezuniyetin ayrı ilişkilerle tutulması sonraki geliştirmedir; aynı e-posta ile ikinci profil açılmaz.

## 5. Toplu yükleme kuralları
.xlsx, en fazla 5 MB ve 500 mezun. İlk çalışma sayfası okunur, ilk satır başlıktır. Satır numarasıyla eksik zorunlu alan / geçersiz e-posta / geçersiz bağlantı / dosya içi mükerrer hata raporu gösterilir. Geçerli satırlar önizlenir. Aynı e-posta varsa mevcut kayıt atlanabilir veya güncellenebilir.

Güncelleme, kaynak alanlarını yeni satırla değiştirir; boş gelen alanlar da eski değeri silebilir. Kullanıcı bu davranışı dosya hazırlarken dikkate almalıdır. Güncellenen kayıt yeniden incelemeye alınır ve paylaşım dayanağı tekrar doğrulanır. PDF dosyası yeni dosya yüklenene kadar korunur. Toplu aktarım doğrudan yayın yapmaz. Yönetici, Mezun yönetimindeki toplu yayımlama düğmesiyle incelemedeki en fazla 500 kaydı, ortak izin/belge referansı ve açık onayla yayımlayabilir. Gizli kayıtlar değiştirilmez.

CV bağlantısı otomatik dosya aktarımı değildir. Linklerin süresi, erişim yetkisi ve kaynak güvenliği bilinmediğinden bu sürüm uzak URL'lerden dosya çekmez. Yetkili kullanıcı CV butonuna bastığında mevcut PDF indirilir; PDF yoksa Excel'deki HTTPS CV bağlantısı açılır. Dış servisin paylaşım izinleri ve indirme/önizleme davranışı geçerlidir. PDF'ler istenirse mezun yönetiminden tek tek yüklenir. Toplu dosya aktarımı için ayrı eşleştirme paketi veya onaylı kaynak entegrasyonu planlanmalıdır.

## 6. Kalıcı veri modeli
Profiles: tekil mezun kimliği, e-posta, profil alanları, pending/published/hidden durumu, paylaşım belge referansı, özel PDF anahtarı ve güncelleme zamanı.
Members: kullanıcı kimliği, kişi e-postası, firma, yetkili adı, pending/approved/suspended durumu, erişim son tarihi, program kapsamı ve kullanım koşulları kabul tarihi/sürümü.
Placements: firma üyeliği, aday, pozisyon, aşama, başlangıç tarihi, ilk iş ve kadın teknoloji istihdamı beyanları, admin teyidi ve üç aylık devam teyidi.
Events: aktör, firma, eylem, hedef kayıt ve zaman. Profil görüntüleme, CV indirme, veri değişikliği ve erişim işlemleri kaydedilir.
Settings: ilk yönetici kimliği ve program/teknoloji sözlüğü.

Profil verileri D1'de, PDF dosyaları özel R2 alanında tutulur. API, CV nesnesinin depolama adresini firmaya vermez. Yüklenmiş PDF indirmesi sunucu üzerinden ve yetki kontrolüyle yapılır. Dış CV bağlantısı da aynı yetki kontrolünden sonra kullanıcıya verilir; dış sunucudaki dosyanın erişimi kaynak servise bağlıdır. Yanıtlar cache edilmez. PDF sihirli başlık ve 10 MB boyut kontrolü vardır; bunlar zararlı dosya taramasının yerine geçmez.

## 7. KVKK için ek adımlar
1. Eski başvuru / bootcamp aydınlatmasının bu yeni amaç ve firma aktarımını kapsayıp kapsamadığı incelenir. Eski CV'nin elde bulunması yeni paylaşımı otomatik olarak meşrulaştırmaz.
2. Veri sorumlusu, amaçlar, işlenen alanlar, hukuki sebepler, alıcı / alıcı grupları, toplama yöntemi ve hak başvuru kanalı kuruma özel aydınlatmada açıklanır.
3. Aydınlatma, açık rızadan ayrı sunulur. Aydınlatma için onay/rıza talep edilmez. İşlem açık rızaya dayanıyorsa özgür, belirli ve bilgilendirilmiş beyan ayrı alınır. Başka işleme şartı mevcutsa gereksiz açık rıza istenmez.
4. İşveren kullanım koşulları mezun beyanının yerine geçmez. Firma, kullanım amacı, üçüncü kişilere aktarım, yetkili personel, saklama, silme ve ihlal bildirim yükümlülüklerini üstlenir.
5. Profil yayın dayanağı, tarih ve metin sürümü / belge referansı kaydedilir. Admin bu alanı mezun adına onay vermek için kullanamaz.
6. Mezun görünürlüğünü kapatabilir. Düzeltme / silme talebi kanalı ve cevaplama sorumlusu tanımlanır. Önceden indirilen kopyaların kontrolü için firma tarafında ayrıca süreç gerekir.
7. Aday havuzu, CV, erişim kayıtları ve işe alım sonuçları için farklı saklama süreleri belirlenir. Bir yıllık ödül dönemi otomatik olarak bütün verilerin saklama süresi değildir.
8. Üretim barındırması, yedekleme, destek erişimi ve olası yurt dışı aktarım değerlendirilir. Sürekli aktarım için genel bir rıza kutusunun yeterli olduğu varsayılmaz. KVKK madde 9 rejimi ve uygun aktarım mekanizması değerlendirilir.
9. Özgeçmişlerde gereksiz özel nitelikli bilgiler, T.C. kimlik numarası ve ayrıntılı adres istenmez. Kullanıcı tarafından yüklenen CV'ler için kontrol ve düzeltme süreci oluşturulur.
10. İstihdama aracılık düzenlemeleri açısından kurumun faaliyet çerçevesi Hukuk ekibiyle netleştirilir.

## 8. Ödüller ve ölçüm
Ekli görseldeki dört kategori korunur:
- İstihdama Destek: teyit edilen işe başlayan tekil mezunlar.
- Kadın İstihdamı: teknoloji rollerindeki teyitli kadın mezun istihdamı. İsimden cinsiyet çıkarımı yapılmaz.
- Sürdürülebilir İstihdam: izleme süresi dolmuş mezunlar arasında en az üç ay devam oranı. Payda, izleme süresi dolan mezunlardır; yeni işe başlayanlar başarısız sayılmaz.
- İlk Kariyer Fırsatı: ilk profesyonel işine başlayan teyitli mezunlar.

Mevcut ekran teyitli adetleri gösterir, otomatik kazanan ilan etmez. Firma bildirimleri admin tarafından firma ve mezun teyidiyle doğrulanmalıdır. Nihai sıralama için dönem başlangıç/bitişi, staj/tam zamanlı ayrımı, aynı mezunun aynı firmaya mükerrer bildirimi, asgari örneklem, eşitlik kuralları ve üç aylık takip tarihi ayrı yönetilmelidir.

## 9. Kabul testleri
- Teknoloji + program + şehir birlikte filtrelenir, sıfırlama tümünü temizler.
- Kişi kartı detay açar, CV düğmesi kart tıklamasını tetiklemez.
- XLSX sütunları kaybolmaz; başarısız satırların numarası görülür.
- Güncelleme yeniden inceleme başlatır, geçerli PDF erişimi admin onayına bağlı kalır.
- Anonim / bekleyen / süresi dolan / durdurulan firma gerçek profil veya CV alamaz.
- İzinli program dışındaki profil ID'sine doğrudan erişim reddedilir.
- Firma A başka firmaya ait işe alım kaydını güncelleyemez.
- Mezun gizlendiğinde sonraki liste, detay ve indirme istekleri engellenir.
- Gerçek havuz boş olduğunda örnek kayıtlar otomatik gerçek kayıt gibi gösterilmez.

## 10. Canlı kullanım hazırlıkları
Tamamlanan çekirdek: uygulama ekranları, filtreleme, detay, admin CRUD, XLSX önizleme ve aktarım, firma kapsam/süre yetkileri, özel PDF yükleme/indirme, erişim kayıtları, işe alım bildirimi ve teyit alanları, QR üretimi.

Ayrıca tamamlanacaklar: kuruma özel hukuki metinlerin onayı, onaylı üretim barındırması, firma paylaşım politikasının açılması, kurumsal kimlik tercihi, mezun davet/rıza toplama akışı, e-posta bildirimleri, otomatik saklama/imha görevi, PDF zararlı içerik taraması, toplu CV transferi, çoklu mezuniyet ilişkisi, nihai ödül hesaplama kuralları ve operasyon desteği. Bunlar yapılmadan bu sürümün tümüyle üretime hazır olduğu iddia edilmez.

## Kaynaklar
- Kullanıcı tarafından paylaşılan Gemini HTML çalışması, ödül görseli ve GY_Kariyer_Agi_Detayli_Sunum.pptx.
- KVKK, 18.02.2026 tarihli 2026/347 İlke Kararı: https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu
- KVKK, istihdam platformu kararı: https://www.kvkk.gov.tr/Icerik/7261/2021-1051
- KVKK, yurt dışına aktarım: https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim

Bu analiz uygulama tasarımıdır. Kuruma özgü hukuki metin ve mevzuat değerlendirmesi ilgili uzman ekiplerce kesinleştirilmelidir.

## Güncel Excel formatı — 25 Ekim 2026
İndirilebilir şablon şu 15 sütunu içerir: Ad-Soyad, Telefon No, E-Mail, Bootcamp Sınıfı, GY Mezun Programı, Yaşadığınız Şehir, Mezun Olunan Üniversite, Üniversite Bölümü, Mezuniyet Senesi, Mezuniyet Ortalaması, Çalışma Durumu, Çalışılan Firma/Kurum, GitHub Adresi, Linkedin Adresi, CV Yükleme. GY Mezun Programı doğrudan program alanına yazılır; teknoloji alanı Bootcamp Sınıfından alınır. Eski Program, GYGY Mezun Dönemi ve Teknoloji Alanları sütunları geriye uyumlu olarak okunur. Yeni başlık ile eski Program birlikte varsa yeni başlık önceliklidir. Yeni formatta mevcut kayıt güncellenirken eski mezun dönemi korunur. Diğer kaynak alanlarında boş gelen değerler eski bilgiyi silebilir. Güncellenen kayıt yeniden incelemeye alınır.

## İşveren iletişim bildirimleri — 1 Kasım 2026
Yetkili firma kullanıcısı öğrenci profilindeki “İletişime geçildi” butonuyla iletişim kurduğunu Akademi yönetimine bildirir. Bu işlem öğrenciye e-posta veya mesaj göndermez, işe alım teyidi sayılmaz. Firma, yetkili adı/e-postası ve bildirim zamanı sunucu tarafından oturumdan kaydedilir. Aynı kullanıcı ve öğrenci için tekrar tıklama ikinci kayıt oluşturmaz. Aynı firmadan farklı kullanıcıların beyanları ayrı izlenir.
Admin üst çubuktaki bildirim sayısını ve “İletişim bildirimleri” menüsünü kullanır. Listede firma, yetkili, öğrenci, program, Türkiye saatiyle tarih ve okundu durumu bulunur. Liste 50 kayıtlık sayfalara ayrılır. Açık panel 30 saniyede bir ve pencereye yeniden dönüldüğünde yenilenir. Bildirimler okunana kadar kalıcıdır; okundu işlemi geçmiş kaydı silmez. Bir mezun silindiğinde ilgili iletişim kayıtları da silinir. Firma kullanıcıları yalnızca kendi beyanlarının öğrenci kimliği ve tarihini görebilir; diğer firmaların bildirimlerine erişemez. Bu sürümde e-posta/push bildirimi yoktur.
