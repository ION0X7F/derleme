# Trendyol Fixture Regression Tests

Bu klasor, Trendyol extractor icin deterministic regression test setlerini tutar.

## Fixture yapisi

Her urun icin bir klasor olustur:

- `pdp.html`
- `embedded.json`
- `runtime-other-sellers.json`
- `runtime-reviews.json`
- `runtime-qa.json`
- `runtime-similar-products.json`
- `runtime-coupons.json`
- `expected-normalized.json`

Tum dosyalar zorunlu degildir. Urunde olmayan alanlar icin runtime dosyasi eklemeyebilirsin.

## Ne test ediyoruz

- HTML parser
- embedded JSON parser
- runtime JSON parser
- merge/priority kurallari
- source/confidence metadata
- other seller ve similar fallback alanlari
- null discipline

## Yeni fixture ekleme

1. `tests/fixtures/trendyol/<urun-slug>/` klasoru olustur.
2. Kucuk ama gercek parser davranisini kapsayan bir `pdp.html` ekle.
3. Runtime loglarini `runtime-*.json` dosyalarina ayir.
4. `expected-normalized.json` icine sadece must-not-regress alanlarini yaz.
5. Gerekirse ilgili test dosyasina urun adini ekle.

## Test calistirma

```powershell
python -m unittest discover trendyol_pdp_extractor.tests.trendyol
```

Tum testler canli siteye gitmeden calisir.

