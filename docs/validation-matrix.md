# Validation Matrix

Bu matris, analiz motorunun beklenen davranisini hizli dogrulamak icindir.

## Veri Kalitesi Senaryolari

1. Guclu veri
- Beklenti: AI `full` veya en az `cautious`
- Trace: `coverageTier` strong/medium
- Suggestions: quality cards ile uyumlu

2. Orta veri
- Beklenti: AI `cautious`
- Trace: blocklayan alanlar acik
- Summary: temkinli ama aksiyonlu

3. Zayif veri
- Beklenti: AI `skip`
- Cikti: deterministic fallback
- Score: belirsiz alanlar puani asiri etkilemez

4. Eksik veri
- Beklenti: kritik alanlar null kalabilir
- AI: susmali
- Trace: `blockedByData` dolu olmali

## Alan Bazli Temkin Kontrolleri

1. `question_count` guvenilmez
- agresif yorum/suggestion tetiklememeli

2. `model_code` dusuk guven
- confidence dusuk kalmali
- ana skor/senaryoyu tek basina degistirmemeli

## AI / Fallback Kontrolleri

1. AI'in susmasi gereken durum
- `analysisTrace.aiDecision.executed=false`
- reason acik ve testlenebilir olmali

2. Rule-based fallback devreye girme
- summary/suggestions dolu ama temkinli olmali
- trace mode deterministic olmali

3. Query/hash varyasyonu ile throttle bypass olmamali
- ayni actor + ayni urun path farkli query ile gelse de guard throttle uygulamalidir
- batch execute asamasinda canonical URL dedupe devrede olmali

## Cikti Tutarliligi

1. Quality cards <> suggestions uyumu
2. Summary <> score tonu uyumu
3. PriorityActions <> suggestions tekrar etmeme
4. `result.decisionSummary` alani analyze/reanalyze cevaplarinda AI/fallback kararini acikca gostermeli

## Batch Execute Cikti Tutarliligi

1. `results[].status` her item icin deterministik olmalidir (`ok`, `analyze_throttled`, `limit_reached`, `pipeline_error`, `internal_error`).
2. `results[].decisionReason` her item icin neden secildigini acik ve deterministik vermelidir (`analysis_completed`, `guard_throttled`, `usage_limit_reached`, `pipeline_failed`, `unhandled_exception`).
3. `statusSummary` alanindaki sayaclar `results` ile birebir uyumlu olmalidir.

## Komutlar

```bash
npm run test:stabilization-checklist
npm run test:ai-decision
npm run test:analysis-decision-summary
npm run test:analyze-response-contract
npm run test:export-route-contract
npm run test:reports-route-contract
npm run test:client-api-contract
npm run test:report-detail-route-contract
npm run test:reanalyze-route-contract
npm run test:report-detail-timeline-contract
npm run lab:analysis-quality
```
