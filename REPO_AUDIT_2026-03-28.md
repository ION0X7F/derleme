# SellBoost AI Repo Audit Notu

Tarih: `2026-03-28`

## 1. Active System Map

- `POST /api/analyze` akisi:
  - `auth()` ile oturum okunur.
  - URL ve body validasyonu yapilir.
  - Kullanim limiti ve abuse guard calisir.
  - `runAnalysisPipeline()` cagrilir.
  - Deterministic analiz olusturulur, gerekiyorsa AI enrichment uygulanir.
  - Sonuc access seviyesine gore sekillenir.
  - Oturumlu kullanicida rapor `createAnalyzeReport()` ile kaydedilir.
  - Learning memory ve kullanim sayaçlari guncellenir.

- `runAnalysisPipeline()` sicak yolu:
  - `fetchPageHtml()` ile HTML cekilir.
  - Trendyol URL'sinde `fetchTrendyolApi()` paralel denenir.
  - `extractFieldsWithFallback()` + `mergeExtractedFieldsWithMetadata()` + `completeMissingFieldsWithMetadata()` ile extraction tamamlanir.
  - Gerekirse Python backfill devreye girer.
  - Trendyol icin review analizi ve follower_count fallback'i uygulanir.
  - `prepareAnalysisInput()` ile contract-girdi katmani kurulur.
  - `buildAnalysis()` deterministic skor, tani ve aksiyonlari uretir.
  - `analysis-contract` + `ai-analysis` ile AI eligibility kontrol edilir.
  - AI sonucu varsa trace ve score override kurallari uygulanir.

- Rapor okuma akisi:
  - `/api/reports` ve `/api/reports/list` ayni `loadReportListForUser()` servisini kullanir.
  - `/api/reports/[id]`, `/export`, `/reanalyze` ortak query/helper katmani olan `report-detail-query.ts` uzerinden calisir.
  - Rapor erisimi `session.user.id` bazli filtrelenir.

- Kullanim limiti akisi:
  - `check-analyze-limit.ts`, `increment-analyze-usage.ts`, `usage-route-response.ts` ve plan cozumlemesi ortak kullanilir.
  - `/api/usage` ve `/api/usage/analyze` ayni usage cevabini verir.

- Dashboard/workspace akisi:
  - Next page wrapper: `app/_ui/dashboard-shell-frame.tsx`
  - Icerik shell: `public/dashboard-shell.html`
  - Parent route <-> iframe view senkronu `postMessage` ve `history.pushState` ile yapilir.
  - Canli raporlar `/api/reports/list`, favoriler `/api/reports/favorites`, profil `/api/auth/session` uzerinden okunur.

- Favoriler akisi:
  - Oturumlu kullanicida `GET/POST /api/reports/favorites`
  - Shell tarafinda favori ID seti tutulur ve rapor listesi buna gore filtrelenir.

- Admin akisi:
  - `/admin`, `/admin/plans`, `/admin/reports`, `/admin/system`, `/admin/users`
  - Mevcut yapida ayrik sayfalar halinde duruyor; bu audit turunda davranissal degisiklik yapilmadi.

## 2. Residue Audit Report

- `lib/access-copy.ts`
  - Sembol: `shouldMaskMissingDataCopy`, `getAccessAwareDiagnosisText`, `getAccessAwareDataCollisionText`, `getAccessAwareRecipeItems`, `shouldHideBlockedByDataNotice`, `shouldHideCoverageSignalsForAccess`
  - Durum: `SAFE_TO_REMOVE`
  - Risk: `low`
  - Gerekce: Repo genelinde arama sonucunda bu export'lar sadece kendi dosyasi icinde geciyor.
  - Oneri: Bir kez daha UI/access katmaninda runtime import olmadigi dogrulanip silinebilir.

- `lib/fetch-html.ts`
  - Sembol: `fetchHtml`
  - Durum: `SAFE_TO_REMOVE`
  - Risk: `low`
  - Gerekce: Aktif sicak yol `fetchPageHtml()` kullaniyor; `fetchHtml()` repo genelinde cagri almiyor.
  - Oneri: Silmeden once harici script ya da dokumantasyon referansi yoksa kaldirilabilir.

- `lib/marketing-routes.ts`
  - Sembol: `MARKETING_ROUTES`, `getMarketingRoute`
  - Durum: `LEGACY`
  - Risk: `low`
  - Gerekce: Canli marketing shell kendi ic `getMarketingRoute()` fonksiyonunu kullaniyor; TypeScript helper import edilmiyor.
  - Oneri: Shell ile ortaklastirilacaksa kullanima alin, alinmayacaksa kaldirma adayi olarak ayrica dogrula.

- `lib/workspace-routes.ts`
  - Sembol: `LEGACY_WORKSPACE_PREFIXES`
  - Durum: `SAFE_TO_REMOVE`
  - Risk: `low`
  - Gerekce: `WORKSPACE_ROUTES`, `getCanonicalReportRoute`, `isCanonicalWorkspacePath` aktif; `LEGACY_WORKSPACE_PREFIXES` tekil tanim olarak kaliyor.
  - Oneri: Kaldirilmadan once eski redirect akisi buna dayaniyor mu diye hizli grep tekrar yapilabilir.

- `app/api/usage/route.ts` + `app/api/usage/analyze/route.ts`
  - Sembol: iki ayri `GET`
  - Durum: `ACTIVE`
  - Risk: `low`
  - Gerekce: Iki endpoint de ayni davranisi sunuyor; biri uyumluluk alias'i gibi yasiyor.
  - Oneri: Ayrik endpointi koru ama kodu tek kaynaktan besle. Bu auditte yapildi.

- `app/api/reports/route.ts` + `app/api/reports/list/route.ts`
  - Sembol: iki ayri liste route'u
  - Durum: `SUSPICIOUS`
  - Risk: `medium`
  - Gerekce: Ikisi de ayni `loadReportListForUser()` servisini kullaniyor. `dashboard-shell.html` birini, `lib/api.ts` digerini kullaniyor.
  - Oneri: Tek route'a dusurmeden once client/public shell uyumlulugu ve harici linkler dogrulanmali.

- `lib/extractors/index.ts`
  - Sembol: lokal `mergeExtractedFields`
  - Durum: `SUSPICIOUS`
  - Risk: `medium`
  - Gerekce: `lib/extractors/merge-extracted-fields.ts` icinde ayni isimli farkli bir merge yardimcisi daha var.
  - Oneri: Bu iki merge yolunun farklari testle belgelenmeden birlestirilmemeli.

- `lib/run-analysis.ts`
  - Sembol: ikinci `if (analysis.trendyolScorecard)` overall hesap blogu
  - Durum: `LEGACY`
  - Risk: `medium`
  - Gerekce: Ayni skor ailesi daha once hesaplanmis durumda; sonraki blokta yeniden yaziliyor.
  - Oneri: Tam kaldirma yerine once davranis esitligi ispatlanmali. Bu auditte sadece hatali formulu duzelttim.

- `lib/auth-provider-config.ts`
  - Sembol: `getConfiguredSocialAuthProvidersFromEnv`, `getConfiguredSocialAuthProviders`, `getSocialAuthUiProvidersFromEnv`, `getSocialAuthUiProviders`
  - Durum: `ACTIVE`
  - Risk: `low`
  - Gerekce: `auth.ts` ve auth config scriptleri tarafindan kullaniliyor.
  - Oneri: Kaldirilacak residue degil.

## 3. Performance Bottleneck Report

- `lib/run-analysis.ts`
  - Lokasyon: Trendyol review analizi + follower count fallback
  - Teshis: Iki network istegi ardışık calisiyordu.
  - Tur: `network-bound`
  - Guven: `definitely happening`
  - Etki: `high`
  - En guvenli cozum: Ayni request scope icinde `Promise.all` ile paralel calistirmak. Bu auditte yapildi.

- `public/dashboard-shell.html`
  - Lokasyon: `ensureHasAuthenticatedSession()` ve `loadCurrentUserProfile()`
  - Teshis: Ayni sayfa acilisinda `/api/auth/session` en az iki kez vuruluyordu.
  - Tur: `network-bound`
  - Guven: `definitely happening`
  - Etki: `medium`
  - En guvenli cozum: Request-scope degil ama page-scope session payload cache. Bu auditte yapildi.

- `lib/run-analysis.ts`
  - Lokasyon: Python backfill yolu
  - Teshis: Extraction sonrasinda ikinci bir dis proses/fallback maliyeti var.
  - Tur: `CPU-bound` + `process-bound`
  - Guven: `likely happening`
  - Etki: `high`
  - En guvenli cozum: Hangi alanlar icin gercekten deger kattigi olculmeli; coverage bazli daraltma yapilabilir.

- `lib/run-analysis.ts` + extraction katmani
  - Lokasyon: `extractFieldsWithFallback()` + merge/complete zinciri
  - Teshis: Ayni HTML uzerinde birden fazla tam tarama ve fallback gecisi olma ihtimali yuksek.
  - Tur: `CPU-bound`
  - Guven: `likely happening`
  - Etki: `medium`
  - En guvenli cozum: Hot HTML selectors/regex gecislerini profiler ile olcup ortak parse sonucu reuse etmek.

- `app/api/reports/route.ts` + `app/api/reports/list/route.ts`
  - Lokasyon: liste API yuzu
  - Teshis: Ayni isi yapan iki endpoint mimari berrakligi bozuyor; farkli client'lar farkli yollara gidiyor.
  - Tur: `architecture / maintenance`
  - Guven: `definitely happening`
  - Etki: `medium`
  - En guvenli cozum: Tek route standardi belirlenip digeri compatibility shim olarak korunmali.

- `public/dashboard-shell.html`
  - Lokasyon: `getAllReports()` -> `getDemoReports()`
  - Teshis: Canli rapor yuklenemezse buyuk demo payload client tarafinda her rapor ekraninda fallback oluyor.
  - Tur: `render-bound`
  - Guven: `definitely happening` fallback durumunda
  - Etki: `medium`
  - En guvenli cozum: Demo fallback'i lazy hale getirmek veya sadece development/demo modunda acmak.

- `app/api/analyze/route.ts`
  - Lokasyon: analyze sonrasi learning write ve usage write
  - Teshis: Kayit sonrasi ardışık ek DB yazimlari var.
  - Tur: `DB-bound`
  - Guven: `likely happening`
  - Etki: `medium`
  - En guvenli cozum: Kritik olmayan post-processing yazimlarini kuyruk/job modeline almak. Bu auditte dokunulmadi.

## 4. Applied Low-Risk Fixes

- `lib/run-analysis.ts`
  - Niyet: Trendyol review analizi ve follower_count fallback'ini paralellestirmek.
  - Neden guvenli: Iki islem de birbirine bagimli degildi; yalnizca bekleme suresi kisaltildi.
  - Beklenen fayda: Trendyol analizlerinde sicak yol latency dususu.

- `lib/run-analysis.ts`
  - Niyet: Duplicate Trendyol overall formulu icindeki self-reference etkisini kaldirmak.
  - Neden guvenli: Ayni dosyada daha onceki dogru formulle hizalandi; kontrat degismedi.
  - Beklenen fayda: Build-analysis ile run-analysis skor tutarliligi.

- `app/api/usage/analyze/route.ts`
  - Niyet: Alias route'u tek kaynaktan beslemek.
  - Neden guvenli: Endpoint aynen korunuyor; sadece `GET` implementasyonu ortak route'tan re-export edildi.
  - Beklenen fayda: Duplicate route mantigi azalir, gelecekte drift riski duser.

- `public/dashboard-shell.html`
  - Niyet: Session payload'ini sayfa scope'unda cache'lemek.
  - Neden guvenli: Zaten no-store ile cekilen ayni payload ikinci kez istenmiyordu; auth davranisi degismedi.
  - Beklenen fayda: Dashboard acilisinda gereksiz auth roundtrip azalir.

## 5. Deferred Medium/High-Risk Items

- `lib/extractors/index.ts` ile `lib/extractors/merge-extracted-fields.ts` merge yardimcilarini birlestirme
  - Neden riskli: Extraction precedence ve metadata davranisi bozulabilir.
  - Sonra ne dogrulanmali: Platform/generic/API birlesim contract'lari, field metadata karar mantigi.
  - Onerilen sonraki adim: Farkli URL fixture'lariyla extractor parity testi yaz.

- `/api/reports` ve `/api/reports/list` yuzeyini teke dusurme
  - Neden riskli: Public shell, client helper ve olasi harici kullanimlarin biri digerini bekliyor olabilir.
  - Sonra ne dogrulanmali: Tüm clientlarin hangi endpointi kullandigi ve response shape esitligi.
  - Onerilen sonraki adim: Once tek route standardi belirle, digerini deprecation shim olarak tut.

- `lib/access-copy.ts` ve `lib/fetch-html.ts` gibi dosyalari fiziksel silme
  - Neden riskli: Repo disi script veya manuel workflow baglantilari gozden kacabilir.
  - Sonra ne dogrulanmali: README, deployment scriptleri, harici tooling referanslari.
  - Onerilen sonraki adim: Iki asamali temizlik; once `@deprecated` notu, sonra kaldirma.

- Python backfill akisini agresif daraltma
  - Neden riskli: Zor sayfalarda veri kapsamini dusurebilir.
  - Sonra ne dogrulanmali: Hangi kritik alanlar backfill olmadan kayboluyor, AI eligibility nasil etkileniyor.
  - Onerilen sonraki adim: Sampling ile hit-rate ve latency olc, sonra gate'i daralt.

- Dashboard shell icindeki demo fallback'leri kaldirma
  - Neden riskli: Demo/guest deneyimi ve hata toleransi bozulabilir.
  - Sonra ne dogrulanmali: Oturumsuz mod, bos rapor durumu, network failover deneyimi.
  - Onerilen sonraki adim: Demo fallback'i feature flag veya explicit demo route altina tasimayi degerlendir.

## Dogrulama

- `npm run build` ✅
- `npm run test:analysis-contract` ✅
- `npm run test:analyze-response-contract` ✅
- `npm run test:reports-route-contract` ✅
- `npm run test:client-api-contract` ✅
