# Inceleme Notlari - 2026-03-30

## RPT-20260330-1DZ8BL

- Alan: `Kupon Durumu`
- Uygulamada gorunen: `Yok`
- Beklenen: Urunde `75 TL kupon` var.
- Not: Bu raporda kupon/promotion extraction kuralinin kupon sinyalini kacirdigi dusunuluyor.
- Teknik bulgu:
  - Canli sayfada `KUPONLU URUN`, `Kuponlar`, `75 TL`, `75 TL Kupon Firsati!` gorunuyor.
  - Ham `fetch()` HTML icinde `75 TL Kupon Firsati` metni yok.
  - Ham HTML tarafinda `hasCollectable: true`, `couponApplicablePrice`, `KUPONLU URUN` benzeri sinyaller var.
  - Mevcut extractor `campaign_label = Kargo Bedava` ve `promotion_labels = [Kargo Bedava]` yakaliyor; kupon sinyali UI'ya tasinmiyor.
  - Sonuc: Kupon var ama sistem `Kupon Durumu: Yok` gosteriyor.
- Cozum:
  - Trendyol extractor artik `merchantListing.winnerVariant.price` alanini ana fiyat icin onceliyor.
  - `original_price <= current price` ise eski fiyat `null` kabul ediliyor.
  - `hasCollectable`, `KUPONLU URUN` ve benzeri sinyaller kupon varligi olarak yorumlaniyor.
  - Bu rapor kaydi icin fiyat ve kupon alanlari DB'de de guncellendi.
