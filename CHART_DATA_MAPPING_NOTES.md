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
| Kampanya Etkisi | kampanya / promosyon alanları sınırlı | Zayıf | Şimdilik demo veya basit tahmin |

## Şu an bağlanamayacaklar

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
