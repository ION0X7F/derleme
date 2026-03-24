# Extractor Observability Logging

Bu katman debug amaclidir. UI paneli degildir. Toggle kapaliyken no-op calisir.

## Debug Flag

- `SELLBOOST_DEBUG_TRACE=1`
- alternatif: `DEBUG_TRACE=true`
- development modunda varsayilan olarak acik kabul edilir

## Loglanan Event'ler

### 1. Fetch stage
- `fetch_html_success`
- `fetch_api_summary`
- `fetch_failed`
- `empty_html`
- `python_stage_timings`
- `python_runner_failed`

### 2. Parse stage
- `critical_field_missing`
- `field_missing`
- `extraction_summary`

### 3. Merge stage
- `merge_summary`
- `field_filled_from_fallback`
- `field_strengthened`
- `missing_data_completion_summary`

### 4. Override/conflict stage
- `field_override_conflict`

### 5. Analysis stage
- `consolidated_input_summary`
- `analysis_input_market_summary`
- `market_comparison_summary`
- `build_analysis_completed`
- `ai_analysis_completed`

### 6. Confidence stage
- `comparison_mode_downgraded`
- `comparison_mode_insufficient`
- `demand_verdict_confidence_downgraded`

## Gurultu Azaltma Mantigi

- ham html/body asla loglanmaz
- auth/cookie/token alanlari filtrelenir
- sadece conflict, missing kritik alan, stage summary ve downgrade olaylari tutulur
- event sayisi `120` ile sinirlanir
- uzun string alanlar kisaltilir

## Sample Trace Output

```json
{
  "enabled": true,
  "pipeline": "run-analysis",
  "urlHost": "www.trendyol.com",
  "platform": "trendyol",
  "summary": {
    "totalEvents": 11,
    "warnings": 3,
    "fetchEvents": 2,
    "parseEvents": 2,
    "mergeEvents": 3,
    "overrideEvents": 1,
    "analysisEvents": 2,
    "confidenceEvents": 1,
    "missingCriticalCount": 1,
    "overrideConflictCount": 1,
    "confidenceDowngradeCount": 1
  },
  "events": [
    {
      "stage": "fetch",
      "code": "fetch_html_success",
      "message": "HTML fetch tamamlandi."
    },
    {
      "stage": "override",
      "code": "field_override_conflict",
      "field": "normalized_price",
      "message": "normalized_price override edildi: platform kazandi, generic yok sayildi."
    },
    {
      "stage": "confidence",
      "code": "comparison_mode_downgraded",
      "message": "Comparison mode same-product yerine similar_products_fallback olarak kullanildi."
    }
  ]
}
```

## Yanlis Override Debug Ornegi

Fiyat yanlis geldiyse su event'ler aranir:
- `field_override_conflict` ve `field=normalized_price`
- `merge_summary`
- `python_stage_timings`

Bu kombinasyon sunlari cevaplar:
- hangi kaynak kazandi
- diger kaynak neydi
- override hangi asamada oldu

## Null Debug Ornegi

`question_count` gelmediyse:
- `critical_field_missing`
- `field_missing`
- `missing_data_completion_summary`

Bu kombinasyon sunlari cevaplar:
- hic bulunamadi mi
- fallback denendi mi
- unresolved critical olarak mi kaldi
