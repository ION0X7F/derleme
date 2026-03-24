# Demand vs Capture Diagnosis

Bu katman, Trendyol extractor'dan gelen dolayli sinyalleri iki ayri soruya cevirir:

- `demandStatus`: Urune ilgi var mi?
- `captureStatus`: Varsa bu ilgiyi teklif/ilan ne kadar yakaliyor?

## Signal Table

| Signal | Demand etkisi | Capture etkisi | Not |
| --- | --- | --- | --- |
| `review_count` | guclu dolayli kanit | sinirli | tek basina yuksek demand iddiasi kurmaz |
| `favorite_count` | orta dolayli kanit | sinirli | tek basina high demand olmaz |
| `question_count` | orta dolayli kanit | sinirli | aktif ilgi sinyali |
| `rating_value` | destekleyici kanit | destekleyici | guven ve memnuniyet sinyali |
| `other_seller_offers` | destekleyici | ana kanit | capture kararinda en guclu kaynak |
| `seller_score` | zayif | guclu | satici itibari ve teklif gucu |
| `shipping_days` / `delivery_type` | yok | orta | teslimat rekabeti |
| `promotion_labels` / `has_campaign` | zayif | orta | promosyon konumu |
| `similar_product_candidates` | yardimci kanit | sadece fallback | same-product gibi okunmaz |
| `keyword visibility` | zayif | yardimci | capture/gorunurluk tarafi icin sinirli katki |
| `seo signals` | zayif | yardimci | sayfa kalitesine sinirli katki |

## Comparison Mode Rules

- `same_product`
  - ayni urunu satan en az 2 anlamli satici bulunduysa
  - capture karari burada en guclu zemine sahiptir
- `similar_products_fallback`
  - same-product yetersizse ve en az 3 benzer urun varsa
  - demand icin yardimci kanittir
  - capture hicbir zaman same-product kadar guclu yorumlanmaz
- `insufficient_data`
  - iki kaynak da karar kurmak icin yetersizse
  - `demandStatus` ve `captureStatus` gerekirse `unclear` kalir

## Confidence Logic

- `high`
  - same-product mode
  - comparison confidence yuksek
  - en az 3 dogrudan demand sinyali var
  - en az 3 comparison pozisyonu biliniyor
- `medium`
  - same-product ama kismi eksik veri
  - veya similar-product fallback + yeterli dogrudan sinyal
- `low`
  - insufficient data
  - veya fallback agirlikli + dusuk guvenli metadata
  - veya demand/capture taraflarindan biri `unclear`

## Example Scenarios

1. Cok saticili, yorum/favori/soru yuksek, fiyat avantajli
   - `demandStatus: high`
   - `captureStatus: strong`
   - `diagnosisConfidence: high`

2. Cok saticili, talep yuksek, fiyat pahali, satici puani zayif
   - `demandStatus: high`
   - `captureStatus: weak`
   - `diagnosisConfidence: high`

3. Cok saticili, talep orta, teklif dengeli
   - `demandStatus: medium`
   - `captureStatus: average`
   - `diagnosisConfidence: medium`

4. Cok saticili ama rakip kimlikleri ve kargo verisi eksik
   - `demandStatus: medium`
   - `captureStatus: average`
   - `diagnosisConfidence: low`

5. Tek saticili, benzer urunlerde guclu sinyaller var
   - `demandStatus: medium`
   - `captureStatus: average`
   - `diagnosisConfidence: medium`

6. Tek saticili, benzer urunler zayif ve urunun kendi sinyalleri de dusuk
   - `demandStatus: low`
   - `captureStatus: unclear`
   - `diagnosisConfidence: low`

7. Tek saticili, benzer urun fallback'i var ama sadece text-based
   - `demandStatus: unclear`
   - `captureStatus: unclear`
   - `diagnosisConfidence: low`

8. Yorum/favori var ama soru yok, same-product da yok
   - `demandStatus: medium`
   - `captureStatus: unclear`
   - `diagnosisConfidence: low`

9. Talep sinyali dusuk ama ayni urunde birkac satici var
   - `demandStatus: low`
   - `captureStatus: average`
   - `diagnosisConfidence: medium`

10. Veri cok eksik, review/favorite/question da sinirli
   - `demandStatus: unclear`
   - `captureStatus: unclear`
   - `diagnosisConfidence: low`

## Notes

- Gercek `sales`, `revenue`, `views`, `add-to-cart` verisi kullanilmaz.
- Similar-product fallback hicbir zaman same-product gibi sunulmaz.
- Derived veya fallback kaynakli demand sinyalleri `high` confidence alamaz.
