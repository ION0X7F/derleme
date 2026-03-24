# SellBoost Commit Plan

Tarih: 24 Mart 2026

Bu belge, mevcut daginik degisiklikleri mantikli commit gruplarina ayirmak icin hazirlandi.

## Hedef

Amac, tek bir buyuk commit yerine davranis olarak anlamli, incelenebilir ve geri alinabilir commitler olusturmak.

## Commit 1: Analysis Core ve API Contracts

Bu commit cekirdek urun mantigini toplar.

Kapsam:

- `lib/run-analysis.ts`
- `lib/prepare-analysis-input.ts`
- `lib/build-analysis.ts`
- `lib/ai-analysis.ts`
- `lib/ai-eligibility.ts`
- `lib/analysis-trace.ts`
- `lib/analysis-contract.ts`
- `lib/analysis-decision-summary.ts`
- `lib/analysis-observability.ts`
- `lib/analysis-user-context.ts`
- `lib/analyze-error-response.ts`
- `lib/analyze-request-guard.ts`
- `lib/analyze-usage-context.ts`
- `lib/analyze-usage-snapshot.ts`
- `lib/batch-analyze-result.ts`
- `lib/check-analyze-limit.ts`
- `lib/competitor-summary.ts`
- `lib/debug-observability.ts`
- `lib/extractors/merge-extracted-fields.ts`
- `lib/increment-analyze-usage.ts`
- `lib/learning-engine.ts`
- `lib/missing-data.ts`
- `lib/python-runner.ts`
- `lib/request-id.ts`
- `lib/url-canonical.ts`
- `lib/url-validation.ts`
- `types/analysis.ts`
- `types/index.ts`
- `app/api/analyze/route.ts`
- `app/api/analyze/batch/route.ts`
- `app/api/usage/route.ts`
- `app/api/usage/analyze/route.ts`

Onerilen commit mesaji:

`feat: harden analysis pipeline and AI fallback contracts`

## Commit 2: Reports, Access, Versioning ve Admin

Bu commit rapor akislarini ve yetki/plan mantigini toplar.

Kapsam:

- `app/api/reports/route.ts`
- `app/api/reports/list/route.ts`
- `app/api/reports/save/route.ts`
- `app/api/reports/[id]/route.ts`
- `app/api/reports/[id]/export/route.ts`
- `app/api/reports/[id]/reanalyze/route.ts`
- `app/api/admin/users/[id]/subscription/route.ts`
- `lib/report-access.ts`
- `lib/report-detail-query.ts`
- `lib/report-history-limit.ts`
- `lib/report-list-query.ts`
- `lib/report-list-service.ts`
- `lib/report-storage.ts`
- `lib/report-versioning.ts`
- `lib/pagination.ts`
- `lib/usage-route-response.ts`
- `lib/user-membership.ts`
- `lib/resolve-plan.ts`

Onerilen commit mesaji:

`feat: add report access, export, paging, and reanalyze flows`

## Commit 3: Auth ve Product UX

Bu commit kullanici akislarini ve sayfa refactor'unu toplar.

Kapsam:

- `auth.ts`
- `lib/auth-callback.ts`
- `lib/auth-provider-config.ts`
- `lib/api.ts`
- `lib/workspace-nav.ts`
- `app/account/page.tsx`
- `app/admin/page.tsx`
- `app/admin/plans/page.tsx`
- `app/admin/reports/page.tsx`
- `app/admin/system/page.tsx`
- `app/admin/users/page.tsx`
- `app/analyze/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/error.tsx`
- `app/error.tsx`
- `app/loading.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/reports/page.tsx`
- `app/reports/[id]/page.tsx`
- `app/reports/[id]/export/page.tsx`
- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `app/_ui/`
- `app/components/home-test-panel.tsx`
- eski `components/` altinda silinen ve artik kullanilmayan parcalar

Onerilen commit mesaji:

`refactor: simplify app ui and align pages with new analysis flows`

## Commit 4: Marketing, Docs ve Release Tooling

Bu commit urun anlatimi, rehberler ve dogrulama scriptlerini toplar.

Kapsam:

- `README.md`
- `PROJECT_STATUS_2026-03-24.md`
- `docs/analysis-pipeline.md`
- `docs/demand-capture-diagnosis.md`
- `docs/developer-guide.md`
- `docs/observability-logging.md`
- `docs/release-readiness.md`
- `docs/seo-rule-engine.md`
- `docs/validation-matrix.md`
- `scripts/`
- `package.json`
- `.env.example`
- `.gitignore`
- marketing ve bilgi sayfalari:
  - `app/about/page.tsx`
  - `app/faq/page.tsx`
  - `app/features/page.tsx`
  - `app/fiyatlandirma/page.tsx`
  - `app/gizlilik-politikasi/page.tsx`
  - `app/hakkimizda/page.tsx`
  - `app/how-it-works/page.tsx`
  - `app/iletisim/page.tsx`
  - `app/kullanim-kosullari/page.tsx`
  - `app/not-found.tsx`
  - `app/pricing/page.tsx`

Onerilen commit mesaji:

`docs: add readiness guides and release verification tooling`

## Commit Oncesi Notlar

- `trendyol_pdp_extractor/` klasoru ayri bir alt proje veya deneysel alan ise ayri commit veya ayri repo olarak dusunulmeli.
- Gecici test ciktisi dosyalari artik `.gitignore` ile disarida tutuluyor.
- Commit atmadan once en az bir kez `npm run build` ve mumkunse `npm run test:readiness-suite` kosulmali.

## Siradaki Operasyonel Adim

Bu planin ardindan en mantikli sonraki adim:

1. `npm run build`
2. `npm run test:readiness-suite`
3. Basarisiz olan testleri tek tek kapatmak

Yani artik "temizlik" fazindan "kalite kapisi" fazina gecebiliriz.
