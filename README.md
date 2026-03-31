# SellBoost AI

SellBoost AI, Trendyol urun URL'lerinden aciklanabilir ve veri odakli satis analizi ureten bir SaaS uygulamasidir.

## Teknoloji

- Next.js App Router
- TypeScript
- Prisma + SQLite
- NextAuth
- Gemini AI (kontrollu katkili)

## Mevcut Odak

- Tek platform: Trendyol
- Tek URL'den guvenilir analiz
- Deterministik rule-based motoru ana guvenlik katmani olarak koruma
- AI katkisini veri guvenine gore sinirlama

## Analyze Pipeline Ozeti

1. URL validation: sadece destekli urun URL'leri kabul edilir.
2. Extraction: platform kaynaklari + HTML + (varsa) API sinyalleri birlestirilir.
3. Missing-data consolidation: eksik alanlar temkinli tamamlanir, guvensiz alanlar null kalir.
4. Consolidated input: her alan value + source + confidence ile normalize edilir.
5. Deterministic analysis: score, quality signals, summary, suggestions uretilir.
6. AI eligibility + analysis contract: AI'nin calisip calismayacagi tek noktadan belirlenir.
7. Trace + report persistence: karar izi, coverage ve rapor kaydi olusturulur.

Detay: [docs/analysis-pipeline.md](docs/analysis-pipeline.md)
Gelistirici notlari: [docs/developer-guide.md](docs/developer-guide.md)
Kontrol matrisi: [docs/validation-matrix.md](docs/validation-matrix.md)
Release kapisi: [docs/release-readiness.md](docs/release-readiness.md)

## Veri Guvenilirligi Yaklasimi

- Kaynak onceligi: API/yapisal veri > platform state/json > generic HTML.
- Dusuk guvenli alanlar zorla doldurulmaz.
- `question_count`, `model_code` gibi problemli alanlar temkinli puanlanir.
- Kapsam zayifsa AI susar, deterministic fallback ana cikti olur.

## AI / Fallback Mantigi

- `analysis-contract` katmani coverage tier (`strong|medium|weak`) hesaplar.
- `weak`: AI skip, deterministic cikti.
- `medium`: AI cautious (sinirli anlatim/suggestion).
- `strong`: AI full (yine guardrail ile).
- AI karari ve fallback nedeni `analysisTrace.aiDecision` alaninda saklanir.

## Lokal Calistirma

```bash
npm install
npm run dev
```

Gerekli env alanlari:

- `AUTH_SECRET`
- `DATABASE_URL`
- `GEMINI_API_KEY` (opsiyonel, yoksa deterministic fallback kullanilir)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` (`1` ise login/register ekraninda Google butonu aktif olur)
- `GITHUB_ID`
- `GITHUB_SECRET`
- `NEXT_PUBLIC_GITHUB_AUTH_ENABLED` (`1` ise login/register ekraninda GitHub butonu aktif olur)
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXT_PUBLIC_DISCORD_AUTH_ENABLED` (`1` ise login/register ekraninda Discord butonu aktif olur)

Not: Bir sosyal giris butonunun aktif olmasi icin ilgili `NEXT_PUBLIC_*_AUTH_ENABLED=1` degeri ile
server tarafinda eslesen client id/secret ciftinin birlikte tanimli olmasi gerekir.

## Dogrulama Komutlari

```bash
npm run build
npm run release:status
npm run test:readiness-suite
npm run test:pre-release
npm run test:auth-callback
npm run test:auth-config
npm run test:url-validation
npm run test:url-canonical
npm run test:report-versioning
npm run test:report-access
npm run test:analyze-guard
npm run test:analysis-trace-access
npm run test:analysis-contract
npm run test:analysis-access
npm run test:analysis-user-context
npm run test:analyze-usage-context
npm run test:analyze-error-response
npm run test:batch-analyze-result
npm run test:analysis-observability
npm run test:analysis-decision-summary
npm run test:analysis-decision-contract
npm run test:analyze-response-contract
npm run test:export-route-contract
npm run test:learning-engine
npm run test:request-id-contract
npm run test:reports-route-contract
npm run test:client-api-contract
npm run test:report-detail-route-contract
npm run test:reanalyze-route-contract
npm run test:report-detail-timeline-contract
npm run test:font-network-contract
npm run test:stabilization-checklist
npm run test:release-readiness
npm run test:ai-decision
npm run lab:analysis-quality
```

## Release Operasyonlari

- Hizli durum ozeti: `npm run release:status`
- Release index: [RELEASE_INDEX_2026-04-01.md](RELEASE_INDEX_2026-04-01.md)
- Release notlari: [RELEASE_NOTES_2026-04-01.md](RELEASE_NOTES_2026-04-01.md)
- Deploy checklist: [DEPLOY_CHECKLIST_2026-04-01.md](DEPLOY_CHECKLIST_2026-04-01.md)
- Handoff ozeti: [HANDOFF_2026-04-01.md](HANDOFF_2026-04-01.md)
- Durum ozeti: [STATUS_2026-04-01.md](STATUS_2026-04-01.md)

## Kritik Dosyalar

- `lib/run-analysis.ts`: pipeline orchestration
- `lib/prepare-analysis-input.ts`: consolidation katmani
- `lib/build-analysis.ts`: deterministic analiz motoru
- `lib/ai-analysis.ts`: AI prompt + sanitize + fallback
- `lib/analysis-contract.ts`: AI/fallback karar kontrati
- `lib/analysis-trace.ts`: aciklanabilir karar izi
- `app/api/analyze/route.ts`: analyze endpoint, limit, access, persistence
- `app/api/reports/[id]/reanalyze/route.ts`: ayni URL icin guvenli yeniden analiz
- `app/api/reports/[id]/export/route.ts`: export payload katmani
- `app/api/analyze/batch/route.ts`: batch analyze temel zemini

## Bilinen Sinirlamalar

- Su an sadece Trendyol hedefleniyor.
- Bazi urunlerde sayfa dinamik oldugu icin kritik alanlar null kalabilir.
- Learning engine MVP modunda korumali (core analizi bozmaz, gerekirse sonradan acilir).
- Cok kisa aralikli ayni URL analyze istekleri abuse guard ile yavaslatilir.
