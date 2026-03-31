# Deploy Checklist - 2026-04-01

## Hedef

Bu checklist, 2026-04-01 urunlestirme turunun canliya alim sonrasi temel kontrollerini tek yerde toplar.

## Deploy oncesi

- `main` dalinin guncel oldugunu dogrula.
- Ortam degiskenlerinin Stripe webhook ve auth ayarlariyla uyumlu oldugunu kontrol et.
- Son kalite kapisini calistir:
  - `npm run lint`
  - `npm run build`
  - `npm run test:readiness-suite`

## Deploy sonrasi uygulama kontrolleri

- Ana analyze akisinda gecerli bir Trendyol urunu ile analiz baslat.
- Job tabanli analyze akisinin kuyruga yazip tamamlandigini kontrol et.
- Reanalyze akisinda yeni rapor zincirinin olustugunu ve kullanim sayacinin dogru guncellendigini kontrol et.
- Dashboard shell ve marketing shell icinde analyze baslangic akisinin calistigini kontrol et.
- Rapor detay ekraninda priority actions ve suggestion alanlarinin beklendigi gibi geldigini dogrula.

## Billing kontrolleri

- Stripe checkout success donusunde plan yenilemesinin oturuma yansidigini kontrol et.
- Subscription update ve cancel senaryolarinda webhook kayitlarinin hata vermedigini kontrol et.
- Payment failure senaryosunda plan/senkronizasyon davranisinin beklenen durumda oldugunu dogrula.

## Gozlemleme

- Uygulama loglarinda `analyze`, `reanalyze`, `stripe webhook` ve `jobs` route hata oranlarini izle.
- Ilk canli analizlerde request id ile hata takibini kolaylastiracak kayitlarin geldigini kontrol et.
- Kupon extraction ile ilgili bilinen vaka icin gerekli ise referans notu kullan:
  - `INCELEME_NOTLARI_2026-03-30.md`

## Basari kriteri

- Kritik route hatasi yok.
- Billing plan senkronizasyonu tutarli.
- Analyze ve reanalyze akislarinda davranissal regresyon yok.
- Release-readiness beklentisi ile canli davranis arasinda belirgin fark yok.
