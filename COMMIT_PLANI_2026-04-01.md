# Commit Plani

Tarih: 1 Nisan 2026

Bu belge, bugfix, mimari refactor, test guvencesi ve repo hijyeni degisikliklerini
inceleme ve yayinlama icin daha guvenli paketlere ayirmak amaciyla hazirlandi.

## Durum Ozeti

Bu calisma sonunda su basliklar ayni agacta birikti:

- Stripe webhook sertlestirmesi
- analyze jobs pre-queue guard
- reanalyze transaction ve usage tutarliligi
- lint/type cleanup
- `middleware` -> `proxy` gecisi
- `run-analysis` moduler refactor'u
- yeni kontrat ve davranis testleri
- `.gitignore` ve gecici log hijyeni

Ek olarak, senden geldigi anlasilan ve bu calismadan bagimsiz durabilecek degisiklikler de var:

- `app/analyze/page.tsx`
- `public/dashboard-shell.html`
- `public/marketing-shell.html`
- `lib/action-engine.ts`
- `INCELEME_NOTLARI_2026-03-30.md`

Bu dosyalar ayri degerlendirilmeli; asagidaki commit paketlerine zorla dahil edilmemesi daha guvenli.

## Onerilen Commit Sirasi

### Commit 1: Billing ve Usage Guvencesi

Amac:
Odeme, plan senkronizasyonu ve analyze limit akisini dogrudan etkileyen davranissal duzeltmeleri ayri tutmak.

Dosyalar:

- `app/api/stripe/webhook/route.ts`
- `app/api/analyze/jobs/route.ts`
- `app/api/reports/[id]/reanalyze/route.ts`
- `app/api/reports/save/route.ts`
- `lib/analyze-request-guard.ts`
- `lib/increment-analyze-usage.ts`
- `lib/report-detail-query.ts`
- `lib/usage-route-response.ts`
- `scripts/analyze-jobs-route-contract-check.ts`
- `scripts/billing-refresh-contract-check.ts`
- `scripts/reanalyze-route-contract-check.ts`
- `scripts/stripe-webhook-contract-check.ts`
- `package.json`
- `package-lock.json`

Onerilen mesaj:

`feat: harden billing, queue guard, and reanalyze usage flows`

### Commit 2: Run Analysis Refactor

Amac:
Davranisi koruyarak analiz pipeline'ini okunur ve bakimi kolay modullere ayirmak.

Dosyalar:

- `lib/run-analysis.ts`
- `lib/run-analysis-helpers.ts`
- `lib/run-analysis-extraction.ts`
- `lib/run-analysis-finalize.ts`
- `lib/learning-engine.ts`
- `types/analysis.ts`

Onerilen mesaj:

`refactor: split run-analysis pipeline into focused modules`

### Commit 3: Analysis Kalite ve Tip Temizligi

Amac:
Refactor'u destekleyen lint/type duzeltmeleri ve davranissal stabilizasyonu ayri paketlemek.

Dosyalar:

- `lib/ai-analysis.ts`
- `lib/build-analysis.ts`
- `lib/analysis-visuals.ts`
- `lib/extract-basic-fields.ts`
- `lib/extractors/merge-extracted-fields.ts`
- `lib/extractors/platforms/trendyol.ts`
- `scripts/analysis-access-check.ts`
- `scripts/analysis-observability-check.ts`
- `scripts/analysis-trace-access-check.ts`

Onerilen mesaj:

`chore: tighten analysis typings and observability checks`

### Commit 4: UI ve Runtime Temizligi

Amac:
Davranissal backend degisikliklerinden bagimsiz, UI/runtime ve framework temizliklerini ayri tasimak.

Dosyalar:

- `app/_ui/dashboard-shell-frame.tsx`
- `app/_ui/route-placeholder.tsx`
- `app/admin/_components/admin-console.tsx`
- `middleware.ts` silinmesi
- `proxy.ts`
- `.gitignore`

Onerilen mesaj:

`refactor: clean dashboard shell and migrate middleware to proxy`

### Commit 5: Modulerizasyon Testleri

Amac:
Yeni mimarinin geri bozulmamasini saglayan lokal kontratlari net bir test commit'inde toplamak.

Dosyalar:

- `scripts/run-analysis-modularization-check.ts`
- `scripts/run-analysis-behavior-check.ts`
- `package.json`
- `package-lock.json`

Not:
Eger `package.json` ve `package-lock.json` Commit 1'de dahil edilecekse, bu committe tekrar ayni dosyalar staging ile parcali alinmali.

Onerilen mesaj:

`test: add modularization and behavior checks for analysis pipeline`

## Ayrica Ayri Tutulmasi Onerilen Dosyalar

Asagidaki dosyalar bu seriyle karismamali:

- `app/analyze/page.tsx`
- `public/dashboard-shell.html`
- `public/marketing-shell.html`
- `lib/action-engine.ts`
- `INCELEME_NOTLARI_2026-03-30.md`

Bunlar icin ayri commit veya ayri branch daha dogru olur.

## Guvenli Staging Sirasi

Eger parcali staging yapilacaksa onerilen akış:

1. Once `git add` ile sadece Commit 1 dosyalarini al.
2. `npm run test:stripe-webhook-contract`
3. `npm run test:analyze-jobs-route-contract`
4. `npm run test:reanalyze-route-contract`
5. Commit at.
6. Sonra Commit 2 dosyalarini al.
7. `npm run test:run-analysis-modularization`
8. `npm run test:run-analysis-behavior`
9. `npm run build`
10. Commit at.
11. Son committen once tam zinciri calistir:
12. `npm run lint`
13. `npm run test:readiness-suite`

## Son Kapi

Bu agac icin son kalite kapisi:

- `npm run lint`
- `npm run test:readiness-suite`

Mevcut durumda ikisi de geciyor ve `release-readiness` sonucu `go_productization`.
