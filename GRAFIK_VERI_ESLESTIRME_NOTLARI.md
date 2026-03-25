# Grafik Veri Eşleştirme Notları

## Doğrudan bağlanabilecekler

| Grafik / Blok | Bizdeki veri | Durum | Not |
|---|---|---|---|
| Genel Skor | `overallScore` | Tam bağlanır | Doğrudan gerçek veri |
| SEO Skoru | `seoScore` | Tam bağlanır | Doğrudan gerçek veri |
| Dönüşüm Skoru | `conversionScore` | Tam bağlanır | Doğrudan gerçek veri |
| Güven Skoru | `derivedMetrics.sellerTrust`, `seller_score`, `rating_value` | Büyük ölçüde bağlanır | Hesaplama kuralı netleştirilmeli |
| Fiyat Pozisyonu | `normalized_price`, `marketComparison.competitorSummary`, `pricePosition` | Tam bağlanır | En güçlü alanlardan biri |
| Rakip Sayısı | `other_sellers_count` | Tam bağlanır | Doğrudan gerçek veri |
| Satıcı Skoru | `seller_score` | Tam bağlanır | Doğrudan gerçek veri |
| Yorum Sayısı | `review_count` | Tam bağlanır | Doğrudan gerçek veri |
| Yıldız Dağılımı | `rating_breakdown` | Tam bağlanır | `reviewDistChart` için uygun |
| Görsel Sayısı | `image_count` | Tam bağlanır | Benchmark sabit veya türetilmiş olabilir |
| Açıklama Derinliği | `description_length` | Tam bağlanır | Karakter bazlı |
| SSS / soru sinyali | `has_faq`, `question_count`, `qa_snippets` | Tam bağlanır | İçerik ve aksiyon tarafında güçlü |
| Rekabet / teklif gücü | `marketComparison`, `other_sellers_summary` | Tam bağlanır | Fiyat ve teklif için güçlü |
| Aksiyon Listesi | `priorityActions` | Tam bağlanır | Demo metin yerine gerçek aksiyonlar |
| Ana sinyaller | `analysisTrace.topSignals`, `benchmarkSignals` | Tam bağlanır | Kartlar ve özet bloklar için uygun |
| Sayfa gücü / kalite | `derivedMetrics.productQuality` | Tam bağlanır | Skor bloklarında iyi çalışır |

## Kısmen bağlanabilecekler

| Grafik / Blok | Bizdeki veri | Durum | Not |
|---|---|---|---|
| İçerik Kalite Radarı | `image_count`, `description_length`, `has_faq`, `question_count`, `derivedMetrics.productQuality` | Kısmi ama güçlü | Radar eksenleri kural bazlı üretilecek |
| Talep Endeksi | `favorite_count`, `review_count`, `question_count`, `rating_value`, `marketOverview` | Tahmini bağlanır | Gerçek satış verisi değil |
| Satış Hacmi Tahmini | `marketComparison.userEstimatedSalesLevel`, `estimatedSalesRange` varsa | Tahmini bağlanır | Gerçek değil, model veya türetim |
| Pazar Payı | `marketPosition`, `salesStatus`, benzer ürün karşılaştırması | Tahmini bağlanır | Kesin veri değil |
| Kampanya Etkisi | kampanya / promosyon alanları sınırlı | Zayıf | Åimdilik demo veya basit tahmin |

## Åu an bağlanamayacaklar

| Grafik / Blok | Sebep |
|---|---|
| Fiyat Geçmişi | Kalıcı zaman serisi yok |
| Günlük görüntülenme | Veri yok |
| Aylık yorum trendi | Tarihsel snapshot yok |
| Sezonsallık | Harici trend kaynağı yok |
| Fiyat esnekliği | Gerçek satış + fiyat geçmişi yok |

## Önerilen uygulama sırası

1. Genel skor kartları
2. Overview sinyal kartları
3. Fiyat ve rekabet grafikleri
4. İçerik ve güven grafikleri
5. Aksiyon listesi
6. Talep / tahmin tarafı

## Puanlama Karari

Puanlama sistemi artik sadece `var / yok` mantigi ile calismamali. Her veri alani icin once gercek veri yakalama, sonra alternatif kaynaklardan kontrollu tamamlama, sonra da kaynak guvenine gore agirlikli katki mantigi uygulanmali.

Temel prensipler:

- Veri varsa, hangi kaynaktan geldigi tutulur.
- Kaynak ne kadar guvenilirse skora katkisi o kadar yuksek olur.
- Dusuk guvenli fallback veriler tam puan getirmez.
- Veri hic yoksa uydurma yapilmaz.
- Veri yoksa alan ceza almaz; sadece bonus katki olusmaz.
- Nihai skor, dogruluk + kaynak guveni + agirlikli katki mantigiyla hesaplanir.

Genel kaynak sirasi:

1. Dogrudan ve yapisal kaynaklar
2. Embedded state / JSON bloklari
3. Teknik tablo / etiketli alanlar
4. Gorunur fallback alanlar
5. Dusuk guvenli parser / heuristik fallback

Genel guven seviyeleri:

- Yuksek guven: tam katki
- Orta guven: azaltilmis katki
- Dusuk guven: sinirli katki
- Bulunamadi: notr

Bu model ilk asamada su alanlara uygulanmistir:

- `meta_description`
- `h1 / resolved_primary_heading`
- `sku / mpn / gtin`
- `has_specs`
- `has_video`
- `has_faq`
- `question_count`
- `favorite_count`
- `has_add_to_cart`
- `has_shipping_info`
- `has_return_info`
- `stock_status`
- `seller_name`
- `seller_badges`
- `official_seller`
- `has_brand_page`
- `has_free_shipping`
- `has_campaign`
- `shipping_days`
- `delivery_type`
- `other_seller_offers`

Sonuc:

Puanlama sistemi artik sadece veri varligina degil, verinin guvenilirligine de bakar. Boylece sistem daha aciklanabilir, daha adil ve daha gercekci bir skor uretir.


