# Analysis Quality Lab

`lab:analysis-quality` analiz ve AI hattini offline senaryolar uzerinde toplu olarak degerlendiren kalite laboratuvaridir.

Ne kontrol eder:

- Yapilandirilmis summary bloklari korunuyor mu
- Summary ve oneriler arasinda recipe hizasi var mi
- Ham alan adi sizintisi kaliyor mu
- Kritik teshis beklenen tema etrafinda toplaniyor mu
- Ilk oneri ana darbozag ile hizali mi

Calistirma:

```bash
npm run lab:analysis-quality
```

Varsayilan mod `fallback` modudur. Bu sayede kosum deterministik kalir ve regresyon takibi daha guvenilir olur.

Istege bagli olarak mevcut `GEMINI_API_KEY` ile denemek icin:

```bash
npm run lab:analysis-quality -- --mode=auto
```

Rapor ciktisi:

- JSON: `artifacts/analysis-quality/*.json`
- Markdown: `artifacts/analysis-quality/*.md`

Bu laboratuvar su senaryolari toplu degerlendirir:

- yavas teslimat
- stok kesintisi
- icerik derinligi zayifligi
- gorsel vitrin zayifligi
- fiyat baskisi
- guven zayifligi
- yorum kaynakli sepet oncesi surtunme

Not:

- `test:ai-regression` daha kucuk ve sert bir koruma katmanidir.
- `lab:analysis-quality` daha genis senaryo kapsami ve rapor uretimi icin tasarlanmistir.
