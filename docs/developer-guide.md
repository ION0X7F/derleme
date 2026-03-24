# Developer Guide

Bu dosya, projeye yeni katilan gelistiricilerin kritik alanlari hizla anlamasi icin hazirlandi.

## Stabil Alanlar

- `lib/run-analysis.ts`: ana analiz orchestration
- `lib/prepare-analysis-input.ts`: consolidation ve guvenilirlik girisi
- `lib/build-analysis.ts`: deterministic cekirdek
- `lib/ai-eligibility.ts` + `lib/analysis-contract.ts`: AI/fallback karar kapisi
- `app/api/analyze/route.ts`: analyze endpoint ve guard/limit akisi

## Deneysel / Kontrollu Alanlar

- `lib/learning-engine.ts`: MVP modda korumali; cekirdek karari etkilemez
- `app/api/analyze/batch/route.ts`: temel batch zemini (sinirli execute)
- `app/api/reports/[id]/reanalyze/route.ts`: URL bazli surum zinciri

## Degisiklik Yaparken Dikkat

1. AI kararini dogrudan prompt tarafinda degistirme.
`analysis-contract` ve `ai-eligibility` birlikte ele alinmali.

2. Eksik veri durumunda "zorla olumlu anlatim" uretme.
`build-analysis` ve `analysis-summary` tarafinda temkinli dil korunmali.

3. Rapor veri modeli JSON agirlikli oldugu icin payload secici ol.
Liste endpoint'lerinde minimum alan dondur.

4. Learning katmani cekirdek motoru override etmemeli.
Learning insight yalnizca yardimci katman olarak kalmali.

## Reports API Notu

- `GET /api/reports` ve `GET /api/reports/list` artik opsiyonel `take` ve `cursor` alir.
- Varsayilan detay modu `compact`tir; tam payload gerekli oldugunda `?detail=full` kullanilabilir.
- `take` plan `historyLimit` ve sistem `MAX_REPORT_TAKE` siniri ile clamp edilir.
- Cevapta `paging.nextCursor` doner, boylece ileride sonsuz scroll veya paged UI kolayca acilir.
- Bu endpoint'ler yetkisiz, basarili ve hata durumlarinda structured trace log yazar.

## Hizli Dogrulama

```bash
npm run test:pre-release
```

Gerekirse sadece rapor sayfalama kontrati icin:

```bash
npm run test:reports-paging
```

URL dogrulama guvenlik kontrati icin:

```bash
npm run test:url-validation
```

URL canonicalization + batch dedupe kontrati icin:

```bash
npm run test:url-canonical
```

Reanalyze surum zinciri kontrati icin:

```bash
npm run test:report-versioning
```

Plan bazli rapor sanitize kontrati icin:

```bash
npm run test:report-access
```

Analyze abuse guard kontrati icin:

```bash
npm run test:analyze-guard
```

Plan bazli trace sanitize kontrati icin:

```bash
npm run test:analysis-trace-access
```

AI/fallback kontrat katmani icin:

```bash
npm run test:analysis-contract
```

Plan->kilitli bolum haritasi kontrati icin:

```bash
npm run test:analysis-access
```

Kullanici plan->analysis context haritalama kontrati icin:

```bash
npm run test:analysis-user-context
```

Analyze usage actor/window ortak helper kontrati icin:

```bash
npm run test:analyze-usage-context
```

Analyze limit/throttle response kontrati icin:

```bash
npm run test:analyze-error-response
```

Batch item result status/shape kontrati icin:

```bash
npm run test:batch-analyze-result
```

Analyze log payload sanitizasyon kontrati icin:

```bash
npm run test:analysis-observability
```

Analyze/reanalyze decision summary kontrati icin:

```bash
npm run test:analysis-decision-summary
```

Analyze/reanalyze API payloadinda decision summary alaninin kalicilik kontrati icin:

```bash
npm run test:analysis-decision-contract
```

Analyze + reanalyze API response payloadinin hafif/kararli kalmasi (report preview + reportId) kontrati icin:

```bash
npm run test:analyze-response-contract
```

Export API mode (full/compact) kontrati icin:

```bash
npm run test:export-route-contract
```

Learning engine guvenli/no-op kontrati icin:

```bash
npm run test:learning-engine
```

API response requestId izlenebilirlik kontrati icin:

```bash
npm run test:request-id-contract
```

Reports API detail mode (`compact` default, `detail=full` override) kontrati icin:

```bash
npm run test:reports-route-contract
```

Client `fetchReports` detail param (`compact/full`) kontrati icin:

```bash
npm run test:client-api-contract
```

Report detail/export endpoint'lerinde paylasilan select kontrati icin:

```bash
npm run test:report-detail-route-contract
```

Reanalyze endpoint'inin minimal base report select kontrati icin:

```bash
npm run test:reanalyze-route-contract
```

Report detail endpoint'inde timeline sorgusunun opsiyonel calisma kontrati icin:

```bash
npm run test:report-detail-timeline-contract
```

Build-time font network bagimsizligi kontrati icin:

```bash
npm run test:font-network-contract
```

## Kritik Akislar

- Analyze: URL validation -> extraction -> consolidation -> deterministic -> AI gating -> persistence
- Reanalyze: mevcut rapor URL'si uzerinden yeni surum olusturma (eski raporu ezmeden)
- Export: plan kilidi kontrolu + export payload olusturma
