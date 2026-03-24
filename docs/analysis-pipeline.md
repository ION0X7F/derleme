# Analysis Pipeline (Core)

Bu dokuman, cekirdek analiz akisinin calisma kontratini ozetler.

## 1) Input Contract

- Zorunlu: gecerli Trendyol urun URL'si
- Reddedilen durumlar:
  - bos/bozuk URL
  - lokal/private host
  - urun path'i olmayan Trendyol URL'si

## 2) Extraction Contract

- `fetchPageHtml` ile sayfa HTML'i alinir.
- Trendyol icin uygun durumda API sinyalleri cekilir.
- HTML ve API fetch adimi paralel yurutulur (hiz kazanimi).
- `mergeExtractedFieldsWithMetadata` ile:
  - field-level source/confidence tutulur
  - kaynak onceligi uygulanir

## 3) Consolidation Contract

- `completeMissingFieldsWithMetadata`:
  - eksikleri temkinli tamamlar
  - guvensiz alanlari zorlamaz
  - unresolved alanlari raporlar
- `prepareAnalysisInput`:
  - DataField yapisi (value/source/confidence/reason) olusturur

## 4) Deterministic Analysis Contract

- `buildAnalysis` her zaman ana guvenlik katmanidir.
- Score + summary + suggestions + priorityActions deterministic uretilir.
- Kapsam dusukse metin daha temkinli kurulur.

## 5) AI Decision Contract

- `isAiAnalysisEligible` + `evaluateAnalysisContract` birlikte calisir.
- Coverage tier:
  - `weak`: AI skip
  - `medium`: AI cautious
  - `strong`: AI full
- AI calissa bile score override ve metin rewrite guardrail ile sinirlidir.

## 6) Trace Contract

- `analysisTrace` su sorulari cevaplar:
  - neden AI calisti/calismadi?
  - hangi alanlar blokladi?
  - ana tema/darbogaz ne?
  - coverage ne?
- `analysisTrace.aiDecision` bu nedenle kritik alandir.

## 7) API Contract (`/api/analyze`)

- limit kontrolu
- abuse guard (ayni actor+URL hizli tekrar)
- pipeline calisma + rapor kaydi
- sanitization (plan bazli alan kirpma)
- guvenli log eventleri
- `diagnostics` payload ile stage sureleri doner (`fetchHtmlMs`, `fetchApiMs`, `extractionMs`, `deterministicMs`, `aiMs`)

## 8) Product Flows

- `/api/reports/[id]/reanalyze`:
  - ayni URL icin yeni analiz olusturur
  - onceki raporu ezmez
  - versioning metadata ile zinciri korur
- `/api/reports/[id]`:
  - rapor + URL bazli timeline doner
- `/api/reports/[id]/export`:
  - export-friendly payload uretir
- `/api/analyze/batch`:
  - `prepare` ve kontrollu `execute` (temel batch zemini)
