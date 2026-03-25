# Çektiğimiz Tüm Veriler Notları

Bu not, sistemin analiz sırasında topladığı ve rapora kaydettiği ana verileri Türkçe olarak özetler.

## Ana veri nerede duruyor?

- Ana rapor tipi: [types/index.ts](/d:/sellboost/types/index.ts)
- Ham ve özet analiz alanları: [types/analysis.ts](/d:/sellboost/types/analysis.ts)
- Rapora kaydedilen veri paketi nasıl oluşturuluyor: [lib/report-storage.ts](/d:/sellboost/lib/report-storage.ts)
- Görsel chart blokları nasıl türetiliyor: [lib/analysis-visuals.ts](/d:/sellboost/lib/analysis-visuals.ts)

## Temel rapor alanları

### `SavedReport`

Yol:
- [types/index.ts](/d:/sellboost/types/index.ts)

Bu üst seviye rapor objesi şunları taşır:
- `id`
  Bu raporun benzersiz kimliği. Raporu açmak, export almak ve tekrar analiz etmek için kullanılır.
- `url`
  Analiz edilen ürün linki. Hangi ürünün tarandığını gösterir.
- `platform`
  Verinin hangi platformdan geldiğini gösterir. Bizde çoğunlukla Trendyol.
- `category`
  Ürünün kategori bilgisi. Benchmark ve kıyaslamalarda işe yarar.
- `seoScore`
  Başlık, açıklama, yapı ve içerik yeterliliği gibi alanlardan türetilen SEO puanı.
- `conversionScore`
  Satışa dönüşme ihtimalini etkileyen yapıların puanı.
- `overallScore`
  Genel sonuç puanı. Dashboardâ€™da en üstte gösterilecek ana skor.
- `dataCompletenessScore`
  Ne kadar veri toplayabildiğimizi gösterir. Eksik veri varsa bunu anlamak için kullanılır.
- `priceCompetitiveness`
  Fiyat rekabet gücünün kısa özeti.
- `summary`
  Ürünün genel durumu için kısa açıklama.
- `dataSource`
  Verinin gerçek mi, fallback mi, sentetik mi olduğunu anlatır.
- `createdAt`
  Raporun oluşturulma zamanı.

## Asıl ürün verisi nerede?

### `SavedReport.extractedData`

Yol:
- [types/index.ts](/d:/sellboost/types/index.ts)
- [lib/report-storage.ts](/d:/sellboost/lib/report-storage.ts)

Bu alan, ürün sayfasından gerçekten çektiğimiz bilgilerin ana gövdesidir.

## Ürün kimliği ve temel katalog alanları

- `title`
  Sayfadaki ürün başlığı. Ekranda ürün adı olarak kullanılır.
- `product_name`
  Normalize edilmiş ürün adı. Başlık varyasyonları arasında daha temiz kullanım sağlar.
- `brand`
  Marka bilgisi. Başlık kalitesi, filtreleme ve karşılaştırmada işe yarar.
- `model_code`
  Model kodu varsa ürün eşleştirme ve benzer ürün kontrolünde işe yarar.
- `category`
  Kategori bilgisi. Benchmark için kritik.
- `sku`
  Ürün kodu varsa teknik eşleştirme için kullanılır.

## Fiyat verileri

- `price`
  Sayfada görünen ham fiyat metni.
- `normalized_price`
  Sayısal ve normalize edilmiş fiyat. Tüm fiyat kıyaslarının temel alanı.
- `original_price`
  İndirim öncesi fiyat varsa burada tutulur.
- `discount_rate`
  İndirim oranı. Kampanya etkisi ve teklif gücü için kullanılır.
- `currency`
  Para birimi bilgisi.

## Görsel verileri

- `image_count`
  Üründe kaç görsel olduğunu gösterir. İçerik kalite puanında çok önemlidir.
- `images`
  Birden fazla görsel URLâ€™si. Kayda alınırken sınırlandırılır.
- `primary_image`
  Küçük ürün fotoğrafı olarak kullanılabilecek ana görsel. Senin özellikle sorduğun "küçük fotoğraf" alanı budur.

Not:
- Küçük fotoğraf için önce `primary_image`
- Alternatif olarak `images[0]`

İlgili yol:
- [lib/report-storage.ts](/d:/sellboost/lib/report-storage.ts)

## İçerik verileri

- `description_length`
  Açıklamanın karakter uzunluğu. Açıklama derinliğini ölçmekte kullanılır.
- `bullet_point_count`
  Maddeli anlatım sayısı. İçeriğin okunabilirliği ve ürün anlatımı için faydalı.
- `has_specs`
  Teknik özellik alanı var mı, onu söyler.
- `has_faq`
  SSS bölümü var mı.
- `qa_snippets`
  Soru-cevap örnekleri. Kullanıcı itirazlarını ve ilgi sinyallerini anlamakta işe yarar.
- `question_count`
  Toplam soru sayısı. Talep ve içerik ilgisi için yardımcı sinyal.

## Güven ve sosyal kanıt verileri

- `rating_value`
  Ortalama yıldız puanı.
- `rating_breakdown`
  1 yıldızdan 5 yıldıza dağılım.
- `review_count`
  Toplam yorum sayısı.
- `review_snippets`
  Seçilmiş yorum örnekleri.
- `review_summary`
  Pozitif / negatif / düşük puanlı yorum özeti.
- `review_themes`
  Yorumlarda öne çıkan olumlu ve olumsuz temalar.
- `top_positive_review_hits`
  En çok geçen olumlu başlıklar.
- `top_negative_review_hits`
  En çok geçen olumsuz başlıklar.

Bu alanlar şu işlere yarar:
- güven puanı üretmek
- müşteri memnuniyetini anlamak
- ürünün güçlü ve zayıf taraflarını yorumlardan çıkarmak

## Satıcı ve teklif verileri

- `seller_name`
  Satıcı adı.
- `seller_score`
  Satıcı puanı. Güven ve teklif gücü için önemli.
- `seller_badges`
  Rozetler veya satıcı etiketleri.
- `official_seller`
  Resmi satıcı mı, onu gösterir.
- `follower_count`
  Satıcı takipçi sayısı.
- `has_free_shipping`
  Ücretsiz kargo var mı.
- `shipping_days`
  Tahmini teslim süresi.
- `delivery_type`
  Teslimat tipi.
- `has_return_info`
  İade bilgisi mevcut mu.
- `has_shipping_info`
  Kargo bilgisi mevcut mu.

## Rekabet verileri

- `other_sellers_count`
  Aynı üründe görünen diğer satıcı sayısı.
- `other_sellers_summary`
  Diğer satıcıların özet karşılaştırması.
  İçinde:
  - `min_price`
  - `max_price`
  - `avg_price`
  - `cheaper_count`
  - `more_expensive_count`
  - `official_count`
  - `fast_delivery_count`
  - `avg_score`
- `other_seller_offers`
  Tek tek rakip teklifleri.
  İçinde:
  - satıcı adı
  - fiyat
  - eski fiyat
  - satıcı puanı
  - ücretsiz kargo
  - hızlı teslimat
  - teklif linki

Bu alanlar şu işlere yarar:
- fiyat konumunu bulmak
- rakip baskısını ölçmek
- kullanıcı teklifinin güçlü mü zayıf mı olduğunu anlamak

## İlgi ve talep sinyalleri

- `favorite_count`
  Kaç kişinin ürünü favorilediği. Gerçek satış değil ama güçlü dolaylı sinyal.
- `review_count`
  Uzun vadeli ilgi göstergesi.
- `question_count`
  Aktif ilgi sinyali.
- `rating_value`
  Memnuniyet desteği sağlar.

Bu alanlar talep tahmini ve pazar ilgisi için birlikte kullanılır.

## Kampanya ve promosyon verileri

- `has_campaign`
  Aktif kampanya var mı.
- `campaign_label`
  Kampanya etiketi.
- `promotion_labels`
  Görülen promosyon yazıları.
- `coupon_offers`
  Kupon bilgileri varsa burada tutulur.
- `cross_promotions`
  Ek promosyon veya yönlendirme blokları varsa burada tutulur.

## Benzer ürün ve eşleştirme verileri

- `similar_product_candidates`
  Benzer ürün adayları listesi.
  İçinde:
  - başlık
  - fiyat
  - puan
  - yorum sayısı
  - marka
  - URL
  - küçük görsel

Bu alanlar şu işlere yarar:
- benzer ürün fallback karşılaştırması
- pazar konumu tahmini
- talep / rekabet tarafında destekleyici kıyas

## Türetilmiş analiz verileri

### `derivedMetrics`

Yol:
- [types/index.ts](/d:/sellboost/types/index.ts)

İçerik:
- `productQuality`
  Sayfa kalitesi ve içerik gücü
- `sellerTrust`
  Satıcı güveni
- `marketPosition`
  Pazar konumu

Bu alanlar ham veri değildir. Ham verilerden hesaplanır.

## İz sürme ve karar açıklama verileri

### `analysisTrace`

Yol:
- [types/index.ts](/d:/sellboost/types/index.ts)

İçerik:
- `primaryDiagnosis`
  Ana teşhis
- `primaryTheme`
  Sorunun ana teması
- `scoreSummary`
  SEO / dönüşüm / genel skor özeti
- `metricSnapshot`
  Hangi metriğin ne durumda olduğu
- `topSignals`
  En önemli sinyaller
- `benchmarkSignals`
  Benchmark kaynaklı sinyaller
- `recommendedFocus`
  Nereye odaklanmak gerektiği

Bu alanlar şu işe yarar:
- raporun neden o sonucu verdiğini açıklamak
- kartları ve aksiyon listesini beslemek

## Görsel blok verileri

### `analysisVisuals`

Yol:
- [types/index.ts](/d:/sellboost/types/index.ts)
- [lib/analysis-visuals.ts](/d:/sellboost/lib/analysis-visuals.ts)

Bu alan, chart üretmek için en uygun hazır pakettir.

Blok örnekleri:
- `price_position`
- `sales_status`
- `growth_opportunity`
- `market_position`
- `market_interest`
- `interest_to_sales_funnel`
- `customer_trust`
- `page_strength`
- `main_challenges`
- `competitor_strength`

Bu alan şu işe yarar:
- dashboard ve rapor ekranındaki grafiklerin doğrudan gerçek veriyle beslenmesi

## Market comparison verileri

### `marketOverview`

Bu alan pazar özetini taşır:
- satış seviyesi
- pazar konumu
- büyüme fırsatı
- fiyat avantajı
- baskı alanları

Bu alan özellikle overview kartları ve özet metinler için faydalıdır.

## Aksiyon ve öneri verileri

- `suggestions`
  Genel öneriler listesi
- `priorityActions`
  Öncelik sırasına dizilmiş aksiyonlar

Bu alanlar şu işe yarar:
- aksiyon paneli
- yapılacaklar listesi
- export çıktıları

## Kayda alınırken özellikle saklanan özet alanlar

Rapor saklanırken bazı alanlar temizlenip, bazıları küçük ve güvenli snapshot olarak tutulur.

Önemli snapshot alanları:
- `normalized_price`
- `image_count`
- `primary_image`
- `rating_value`
- `review_count`
- `favorite_count`
- `question_count`
- `seller_score`
- `seller_name`
- `official_seller`
- `shipping_days`
- `delivery_type`
- `other_sellers_count`

İlgili yol:
- [lib/report-storage.ts](/d:/sellboost/lib/report-storage.ts)

## Küçük fotoğraf hangi alan?

Evet, küçük ürün fotoğrafını da alıyoruz.

Kullanılacak alan sırası:
1. `extractedData.primary_image`
2. `extractedData.images[0]`
3. `similar_product_candidates[].thumbnail` sadece benzer ürünler için

## Kısa özet

Bizim gerçekten çektiğimiz veri grupları:
- ürün kimliği
- fiyat
- görseller
- içerik
- yorum ve puan
- satıcı güveni
- kargo / teslimat
- rakip satıcılar
- talep sinyalleri
- kampanya / promosyon
- benzer ürünler
- türetilmiş skorlar
- grafik üretmeye uygun görsel bloklar
- aksiyon ve öneriler

Bu notun amacı şudur:
- hangi veri elimizde var
- hangi alan ne işe yarıyor
- hangi alanı UIâ€™da nerede kullanabiliriz


