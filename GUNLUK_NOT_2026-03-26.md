# Günlük Not (26 Mart 2026)

## 26 Mart 2026 - Kural Kaynağı Düzeni

- Dashboard sekmeleri için merkezi kural tabanı başlangıcı oluşturuldu: `lib/trendyol-rulebook.ts`
- Sekme/kart bazlı kaynak matrisi eklendi: `docs/trendyol-tab-rule-matrix.md`
- Kural çözümleyici eklendi: `lib/trendyol-rule-resolution.ts`
- Geliştirici kontrol endpoint'i eklendi: `/api/dev/trendyol-rulebook`
- `23:14` Dashboard shell, çözümlenmiş rulebook'u yükleyip `Güven & Yorum` ve `Talep Sinyalleri` tarafında kural bağlantısını kullanacak hale getirildi. Kural yüklenemezse legacy davranış korunuyor.
- Kural çözümleme prensibi netleştirildi:
  - Notlarda açık kural varsa uygulanır
  - Açık kural yoksa legacy davranış korunur
  - Daha yeni not, eski kuralı otomatik silmez
  - Yeni not ek kural getiriyorsa eski kural ile birlikte yaşar
  - Sadece açık çelişki varsa daha yeni olan baskın alınır

## Bugün Ne Yaptık?

Bugün sistemi tekrar gerçek veriye yaklaştırmak için iki ana alanda çalıştık:

1. Veri çekme katmanı (Trendyol + Python fallback)
2. Dashboard kart ve grafik bağları (demo yerine canlı veri)

---

## 1) Veri Çekme Katmanı

### Katmanlı akış netleştirildi
- Önce hızlı ana kaynaklar (extractor + API + runtime) kullanılıyor.
- Eksik kalan alanlar varsa Python fallback devreye giriyor.
- Python’dan gelen veri sadece boş alanları dolduruyor, dolu alanları ezmiyor.

### Trendyol extractor iyileştirmeleri
- `merchant_id` HTML’den güvenli şekilde çıkarılacak hale getirildi.
- `follower_count` için selector + HTML fallback eklendi.
- Satıcı takipçi sayısı için Trendyol follower endpoint entegrasyonu eklendi.

### Python ile tamamlanan alanlar
- `original_price`, `discount_rate`, `qa_snippets`, `question_count`,
  `other_sellers_count`, `other_seller_offers`, `other_sellers_summary`,
  `similar_product_candidates` gibi alanlarda eksiklerin tamamlandığı görüldü.

### Bilinçli olarak devre dışı bırakılan alanlar
- `search_snippet_fallback`
- `model_code`
- `mpn`, `mpn_source`
- `gtin`, `gtin_source`

Bu alanlar ürün karar akışında kritik olmadığı için sadeleştirme amacıyla devre dışı bırakıldı.

---

## 2) Dashboard Bağlantıları

### Rapor detay ekranı
- Fiyat/rakip kartları gerçek veriye bağlı çalışır hale getirildi.
- Kampanya dönüşüm senaryosu kartı dinamik hesapla güncelleniyor.
- Özet sekmesindeki sabit grafikler gerçek rapor datasından türetilen dinamik hesaplara taşındı.

### Overview ekranı
- Overview artık canlı rapor listesinden besleniyor.
- KPI kutuları (ortalama skor, toplam rapor, veri tamamlanma, bekleyen aksiyon) dinamik hesaplanıyor.
- Overview grafiklerinin tamamı gerçek raporlardan üretiliyor:
  - Aylık analiz aktivitesi
  - Skor dağılımı
  - Sayfa gücü
  - Müşteri güveni
  - Pazar konumu
  - Ana zorluklar
- “Son Raporlar” ve “Tüm Raporlar” tabloları canlı rapor listesiyle render ediliyor.

---

## Test / Durum

- `npm run build` başarılı geçti.
- Veri yoksa demo fallback korunuyor.
- Veri varsa canlı veri öncelikli kullanılıyor.

---

## Sonraki Adım Önerisi

- Overview’deki “Ana Zorluklar” ve “Pazar Konumu” formüllerini eski kural setindeki ağırlıklarla birebir eşleştirebiliriz.
- Böylece hem sayı hem yorum katmanı tamamen kurallarla tutarlı olur.
---

## Bekleyen Notlar

- `21:21` Trendyol ürün açıklaması tespitinde kritik ayrım notu:
  Cream Co raporunda gerçek `Ürün Açıklaması` boş olmasına rağmen sistem `meta_description` metnini açıklama gibi saymış. `Ek Bilgiler` ile açıklama karışmadı; asıl sorun meta alanının `description_length` hesabına girmesiydi. Kod tarafında ayrım düzeltildi, ancak mevcut eski rapor kaydı yeniden analiz edilmeden doğru görünmeyecek.

- `23:41` Merkezi rulebook bağlantısı genişletildi:
  `dashboard-shell.html` içinde `İçerik & SEO`, `Fiyat & Rakip` ve `Aksiyonlar` katmanları çözümlenmiş kural setine bağlandı. Uygulanan güvenli bağlantılar:
  - `content-meta-is-secondary`: açıklama kartında meta sinyalini birincil açıklama gibi göstermeme
  - `actions-no-duplicate-rephrasing`: aynı önerinin farklı kelimelerle tekrarını normalize ederek engelleme
  - `actions-evidence-required`: aksiyon helper metnini veri dayanaklı dil ile gösterme
  - `price-no-duplicate-own-bar`: fiyat aralığı grafiği alt açıklamasını tekilleştirilmiş min/ort/max mantığıyla güncelleme
  Notlarda açık kural olmayan yerlerde legacy davranış korunmaya devam ediyor.

- `23:49` Güven & Yorum ile Talep Sinyalleri tarafında ortak kural dili bağlandı:
  - `shared-null-is-not-zero`: ürün puanı / yorum hacmi verisi yoksa sahte güçlü yorum yerine `veri sınırlı` dili gösteriliyor
  - `trust-general-vs-seller-review-separation`: güven radar kartı alt metni ürün geneli ve satıcı operasyon sinyallerini birlikte ama ayrı anlamda okuduğunu belirtiyor
  - yorum temaları kartı `Örneklenen genel ürün yorum temaları` olarak netleştirildi
  - `shared-estimated-language`: talep kartlarında düşük güvenli tahminlerde `sınırlı veriyle tahmini` dili görünür hale getirildi
  - tahmini aylık satış grafiği alt metni veri güvenine göre dinamikleşti

- `23:55` Overview ekranı da merkezi kural diline bağlandı:
  - `customer_trust` overview kartı ürün geneli + satıcı operasyon ayrımını alt metinde görünür taşıyor
  - `market_position` overview kartı artık kural seti tahmini dil istiyorsa `Tahmini rekabet konumu` olarak yazıyor
  - `main_challenges` overview kartı alt metni `Kural bazlı zorluk frekansı` olarak güncellendi
  - overview müşteri güveni hesabında eksik yorum hacmi verisi sahte sıfır gibi okunmuyor

- `00:02` Summary sekmesindeki ana radar ve pazar konumu matematiği sıkılaştırıldı:
  - ana radar artık notlardaki ağırlıklara daha yakın bir birleşimle hesaplanıyor
  - `SEO / Görünürlük`: başlık, kategori uyumu, teknik alan, görsel, teklif, favori, yorum+puan ve görünürlük sinyali birleşimi
  - `Dönüşüm`: puan, yorum, açıklama, görsel, fiyat, ücretsiz kargo, teslimat, soru-cevap ve satıcı güveni birleşimi
  - `Güven`: satıcı puanı, resmi satıcı, iade/kargo netliği, teslimat, stok riski, yorum güveni ve negatif oran birleşimi
  - summary radar alt metni `Kural bazlı görünürlük + dönüşüm + güven birleşimi` olarak güncellendi
  - summary pazar konumu alt metni talep güveni düşükse `Sınırlı veriyle tahmini rekabet konumu` diline düşüyor

- `00:08` Kalan kart isimleri ve alt açıklamaları rule matrix ile hizalandı:
  - `Yorum Artış Trendi` başlığı `Aylık Yorum Trendi` olarak netleştirildi
  - `Yorum Temaları` kartı statik tarafta da `Örneklenen genel ürün yorum temaları` diline çekildi
  - `Güven Boyutları` kartı ürün geneli + satıcı operasyon sinyali ayrımını baştan taşıyor
  - `İlgi → Satış Hunisi` kartı `Tahmini İlgi → Satış Akışı` oldu; gerçek funnel gibi okunmaması için alt metin güncellendi
  - `Pazar İlgisi` ve `Pazar Genel Değerlendirme` kartlarının alt metinleri veri güvenine göre daha dürüst hale getirildi

- `00:12` Türetilmiş skor etiket bantları notlardaki genel eşiklere yaklaştırıldı:
  - `0-39`: düşük
  - `40-69`: orta
  - `70-100`: güçlü
  Bu bantlar `Talep Sinyali`, `Büyüme Fırsatı` ve bunların renk/etiket yorumlarında uygulanmaya başlandı.
  Eski `65/45` bandı yerine merkezi `getDerivedBand()` kullanılıyor.

- `00:18` İçerik & SEO tarafındaki eski eşikler güvenli biçimde merkezileştirildi:
  - Notlarda açık yeni eşik olmadığı için `80/55` davranışı korunuyor
  - Bu eşikler artık `getLegacyContentBand()` üzerinden okunuyor
  - `Kategori Uyumu`, `Açıklama Yeterliliği`, `Görsel Sayısı`, `Maddeleme` ve ilgili chart renkleri aynı helper’dan besleniyor
  - Böylece mevcut davranış değişmeden, hangi eşiklerin legacy olarak korunduğu kodda görünür hale geldi

- `00:24` Overview ve rapor tablolarındaki genel skor eşikleri merkezileştirildi:
  - Notlarda açık yeni bant olmadığı için eski `80/60` genel skor davranışı korunuyor
  - Bu eşikler artık `getLegacyOverallBand()` ve `getLegacyOverallStatus()` üzerinden okunuyor
  - overview ortalama skor notu, kritik rapor sayısı, skor dağılımı, rapor tablo badge’leri ve recent analysis renkleri aynı helper’dan besleniyor
  - Böylece `Genel / Güçlü / İyileştir / Kritik` mantığı tek yerde görünür hale geldi

- `00:31` Demo/adaptasyon katmanındaki eski AI ve ham kaynak metinleri temizlendi:
  - demo ürünlerdeki `AI başlık ile kategori...` benzeri notlar nötr kural diliyle değiştirildi
  - `runtime_xhr`, `embedded_json`, `parser_inference`, `html` gibi ham kaynak isimleri kullanıcı diline çevrildi
  - `adaptApiResultToReportData()` artık veri kaynağını `canlı çekim / gömülü veri / çıkarım / html yakalama` gibi okunur etiketlerle taşıyor
  - statik placeholder metinlerde de gereksiz `AI destekli` ve ham kaynak adı kalıntıları temizlendi

- `00:37` Kural görünürlüğü debug katmanına taşındı:
  - `lib/trendyol-rule-coverage.ts` eklendi
  - burada kart -> sekme -> rulebook section -> explicit rule id eşleşmeleri tutuluyor
  - `app/api/dev/trendyol-rulebook/route.ts` artık `resolved` yanında `coverage` da döndürüyor
  - `docs/trendyol-tab-rule-matrix.md` içine teknik coverage kaynağı referansı eklendi
  - bu katman yeni kural üretmiyor, sadece hangi kartın hangi kural setine bağlı olduğunu görünür kılıyor

- `00:43` Coverage çıktısına açıkta kalan kart görünürlüğü eklendi:
  - `coverageLevel`: `explicit / partial / legacy`
  - `coverageSummary`: toplam kapsama özeti
  - `coverageGaps`: özellikle `partial` ve `legacy` kalan kart listesi
  - böylece debug endpoint üzerinden hangi kartların hâlâ açık explicit rule’a bağlanmadığı görülebiliyor

- `00:49` Coverage açıkları önceliklendirildi:
  - coverage öğelerine `priority: high / medium / low` alanı eklendi
  - `/api/dev/trendyol-rulebook` çıktısı artık `recommendedCoverageWork` da döndürüyor
  - böylece `partial / legacy` kartlar sadece görünür olmakla kalmıyor, önerilen uygulama sırasıyla da listeleniyor

- `00:56` Yüksek öncelikli bazı kartlar gerçekten explicit rule seviyesine taşındı:
  - `Ürün / Kategori Uyumu` için `content-category-fit-from-title-and-keywords`
  - `Yorum Hacmi` için `trust-review-volume-is-direct-signal`
  - `Son 10 Yorum` için `trust-recent-reviews-are-sampled`
  - `Pazar Konumu` için `demand-market-position-is-relative`
  - `Pazar Genel Değerlendirme` için `demand-market-summary-needs-estimated-language`
  - coverage seviyeleri buna göre güncellendi; bazı yüksek öncelikli `legacy/partial` kartlar artık `explicit`
- `23:47` Merkezi rulebook katmani toparlandi ve orta oncelikli bazi kartlar explicit rule seviyesine yaklastirildi:
  - `lib/trendyol-rulebook.ts` bastan temizlenerek yeniden yazildi; kirik `explicitRules` blogu onarildi
  - yeni explicit rule id'ler eklendi:
    - `price-competitor-advantages-from-offer-signals`
    - `content-primary-keywords-algorithm-first`
    - `demand-growth-opportunity-is-gap-based`
    - `demand-market-interest-is-composite`
    - `actions-priority-matrix-is-relative`
    - `actions-score-improvement-is-estimated`
  - `Rakip Avantajlari`, `Birincil Anahtar Kelimeler`, `Buyume Firsati`, `Pazar Ilgisi`, `Aksiyon Oncelik Matrisi`, `Tahmini Skor Iyilesmesi` coverage kaydi explicit rule id'lerle guncellendi
  - `dashboard-shell.html` tarafinda bu rule id'ler alt metin ve not katmanina baglandi:
    - rakip avantajlari karti teklif bazli sinyal diliyle okunuyor
    - birincil anahtar kelimeler karti algoritma oncelikli cikarim diliyle netlesiyor
    - buyume firsati ve pazar ilgisi grafikleri explicit kural diline gore alt metin uretiyor
    - aksiyon matrisi ile skor iyilesmesi grafikleri goreli/tahmini dil kurallarini kullaniyor
  - `node -e "require('./lib/trendyol-rulebook.ts')"` ve `node -e "require('./lib/trendyol-rule-coverage.ts')"` ile temel sozdizimi dogrulamasi yapildi

- `23:50` Kalan dusuk/orta oncelikli kartlarin buyuk kismi explicit rule seviyesine tasindi:
  - yeni explicit rule id'ler eklendi:
    - `content-keyword-ranking-cache-first`
    - `content-radar-axes-are-rule-based`
    - `trust-dimensions-must-label-proxies`
    - `demand-funnel-is-estimated-not-real`
  - coverage tarafinda su kartlar explicit oldu:
    - `Anahtar Kelime Siralamasi`
    - `Icerik Kalite Radar`
    - `Guven Boyutlari`
    - `Tahmini Ilgi -> Satis Akisi`
  - `dashboard-shell.html` tarafinda:
    - anahtar kelime siralamasi cache sonucu varsa `son bulunan sonuc` diliyle okunuyor
    - icerik kalite radar alt metni rule-based eksen + legacy koruma mantigini soyluyor
    - guven boyutlari karti `dogrudan veri + proxy eksenleri` oldugunu acikca belirtiyor
    - ilgi -> satis hunisi karti explicit kural varsa `gercek funnel degil` dilini zorluyor
  - coverage ozeti `25 kartin 24'u explicit, 1'i legacy` seviyesine geldi
  - tek bilincli legacy kart `Kampanya Donusum Senaryosu` olarak birakildi; notlarda acik ve guvenli explicit kural bulunamadigi icin legacy korunuyor

- `23:51` Dokumantasyon ve debug gorunumu son durumla hizalandi:
  - `docs/trendyol-tab-rule-matrix.md` bastan temiz ASCII formatta yeniden yazildi
  - matrix icinde artik explicit hale gelen kartlar acik kural olarak isaretleniyor
  - sadece `Kampanya Donusum Senaryosu` kartinin bilincli legacy kaldigi dokumanda da acikca belirtildi
  - `/api/dev/trendyol-rulebook` route metadata'sina `intentionalLegacyCards` ve `remainingLegacyCount` alanlari eklendi
  - coverage dogrulamasinda mevcut durum:
    - `total: 25`
    - `explicit: 24`
    - `legacy: 1`
    - kalan legacy kart: `Kampanya Donusum Senaryosu`
  - Not: Next route dosyasi duz `node require` ile dogrulanamadi; `next/server` importu calisma zamani bagimli oldugu icin bu test lokal Node ortaminda patladi. Buna ragmen coverage katmani dogrudan dogrulandi.

- `00:01` Projenin link yapisi kanonik rotalara cekildi:
  - yeni merkezi route helper dosyalari eklendi:
    - `lib/workspace-routes.ts`
    - `lib/marketing-routes.ts`
  - dashboard tarafinda:
    - `app/_ui/dashboard-shell-frame.tsx` icindeki eski `#new-analysis` / `hashchange` mantigi kaldirildi
    - iframe icinden gelen navigation mesajlari normalize ediliyor
    - eski `/reports/:id` linki gelse bile kanonik `/report/:id` rotasina cevriliyor
  - eski detay yolu artik resmi olarak legacy:
    - `app/reports/[id]/page.tsx` artik icerik render etmiyor, `permanentRedirect('/report/:id')` yapiyor
    - `next.config.ts` icine de `/reports/:id -> /report/:id` redirect eklendi
  - auth/nav yardimcilari da ayni kanonik route setini kullaniyor:
    - `lib/auth-callback.ts`
    - `lib/workspace-nav.ts`
  - marketing tarafinda:
    - `app/_ui/marketing-shell-frame.tsx` artik iframe icinden gelen `sellboost:navigate` mesajlarini router ile ust URL'ye tasiyor
    - `public/marketing-shell.html` icinde butonlar sadece iframe ici page degistirmiyor; artik `/`, `/features`, `/pricing`, `/login`, `/register`, `/report-demo` rotalarina parent navigation mesaji gonderiyor
    - ayni anda iframe query state'i de senkron tutuluyor
  - hedefli lint calistirildi ve gecti:
    - `app/_ui/dashboard-shell-frame.tsx`
    - `app/_ui/marketing-shell-frame.tsx`
    - `app/reports/[id]/page.tsx`
    - `lib/workspace-routes.ts`
    - `lib/marketing-routes.ts`
    - `lib/auth-callback.ts`
    - `lib/workspace-nav.ts`
    - `next.config.ts`

- `00:05` Kanonik route gecisinin kalan guvenli temizlikleri tamamlandi:
  - proje genelinde URL yapisi yeniden tarandi; legacy `/reports/*` ve kanonik `/report/*` kullanimlari karsilastirildi
  - `next.config.ts` icine `/reports/:id/export -> /report/:id/export` permanent redirect eklendi
  - `app/reports/[id]/export/page.tsx` legacy export placeholder yerine kanonik export rotasina `permanentRedirect` yapacak sekilde guncellendi
  - `lib/auth-callback.ts` icinde `/reports/...` ile gelen callback path'leri sessizce `/report/...` formatina normalize edildi
  - boylece detail route temizliginden sonra export ve auth callback tarafinda kalan legacy workspace URL izleri de dar kapsamli sekilde toparlandi
