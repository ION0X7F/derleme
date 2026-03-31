# Release Notes - 2026-04-01

## Ozet

Bu turda odak, urunlestirme oncesi kritik riskleri kapatmak ve analyze altyapisini daha guvenli hale getirmekti.

## Tamamlanan basliklar

- Stripe webhook akisi subscription update, delete ve payment failure senaryolarini kapsayacak sekilde genisletildi.
- Reanalyze kullanim dusumu ve rapor olusturma akisi transaction guvencesine alindi.
- Analyze job kuyruguna yazmadan once limit ve abuse guard kontrolleri eklendi.
- Dashboard shell davranisi temizlendi ve runtime tarafinda `middleware` yerine `proxy` yapisina gecildi.
- `run-analysis` dosyasi extraction, helper ve finalize katmanlarina bolunerek orchestration odakli hale getirildi.
- Rule-based action engine taslagi eklendi.
- Coupon extraction ile ilgili inceleme notu ve bulgular repoya eklendi.

## Guvence

- `npm run lint`
- `npm run build`
- `npm run test:readiness-suite`
- `release-readiness`: `go_productization`

## Ana commitler

- `190fdf4` `feat: harden billing, queue guard, and reanalyze usage flows`
- `dea44d7` `refactor: split analysis pipeline into focused modules`
- `697f992` `refactor: clean dashboard shell and migrate middleware to proxy`
- `e1b0cea` `docs: add release commit plan for april productization pass`
- `32f266f` `feat: add keyword-aware prefill and live analysis marketing flow`
- `fe92dc1` `feat: add rule-based action engine draft`
- `ba38d22` `docs: add coupon extraction investigation notes`
