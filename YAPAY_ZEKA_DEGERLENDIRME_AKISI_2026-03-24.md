# SellBoost Yapay Zeka Değerlendirme Akışı

Tarih: 24 Mart 2026

Bu belge, SellBoost icinde AI katmaninin gelen veriyi nasil degerlendirdigini teknik olarak ozetler.

Amac, su 3 soruya net cevap vermektir:

1. AI'ye tam olarak hangi veri gidiyor
2. `cautious` ve `full` modlari arasindaki fark nedir
3. AI hangi durumlarda tamamen susturulur

## 1. AI'ye Tam Olarak Hangi Veri Gidiyor

AI ham HTML ile dogrudan calismaz.

Oncesinde su katmanlar tamamlanir:

1. HTML fetch
2. Trendyol API fetch varsa paralel cekim
3. extractor merge
4. missing data completion
5. consolidated input normalization
6. deterministic analysis
7. AI eligibility + contract karari

Bu nedenle AI'nin girdisi "sayfadan ne bulduysak verelim" mantigi degildir.
AI'ye yalnizca normalize edilmis, kaynak ve guven bilgisi tasiyan veri gider.

### 1.1 Consolidated input

Ana kaynak:

- `lib/prepare-analysis-input.ts`

Bu katmanda alanlar `DataField` yapisina doner:

- `value`
- `source`
- `confidence`
- `reason`

Ornek alanlar:

- `title`
- `brand`
- `productName`
- `modelCode`
- `price`
- `originalPrice`
- `imageCount`
- `ratingValue`
- `reviewCount`
- `descriptionLength`
- `sellerName`
- `sellerScore`
- `isOfficialSeller`
- `hasFreeShipping`

Bu alanlar tek basina degil, kaynagina gore agirliklandirilir:

- `runtime_xhr` / API en guvenli
- `embedded_json` yuksek guvenli
- `html` orta seviye
- `parser_inference` / `derived` daha temkinli

Yani AI bir alani sadece "dolu" diye guvenli kabul etmez; confidence degerini de dolayli olarak miras alir.

### 1.2 Raw extracted data

Ana kaynak:

- `lib/run-analysis.ts`
- `lib/ai-analysis.ts`

AI'ye yalnizca consolidated input degil, belirli ham alanlar da gider:

- fiyat alanlari
- kampanya alanlari
- diger satici ozeti
- diger satici teklifler
- review summary
- review themes
- QA snippetleri
- teslimat / kargo bilgileri
- stok / varyant bilgileri
- bestseller alanlari

Ancak bunlar da serbest kullanim icin degil, `depends_on` mekanizmasi ile kontrollu yorum icin kullanilir.

### 1.3 Decision support packet

Ana kaynak:

- `lib/build-analysis.ts`

AI'ye deterministic katmanin urettiği yardimci karar paketi de gider.
Bu paket icinde:

- derived metrics
- coverage
- market comparison
- benchmark sinyalleri
- temel skorlar

yer alir.

Bu cok onemlidir:
AI ilk analizi ureten taraf degil, deterministic motorun urettigi zemini yorumlayan katmandir.

### 1.4 Baseline

Ana kaynak:

- `lib/ai-analysis.ts`

AI'ye bir de deterministic fallback baseline verilir:

- `summary`
- `strengths`
- `weaknesses`
- `suggestions`
- `seo_score`
- `conversion_score`
- `overall_score`

Bu baseline, AI'nin tamamen yeni bir analiz uydurmasini engeller.
AI daha cok bu baseline'i genisletir, yeniden ifade eder veya sinirli sekilde iyilestirir.

### 1.5 Missing data report ve learning context

AI'ye ek olarak:

- `missingDataReport`
- `learningContext`

de gider.

Bunlar sayesinde model:

- hangi alanlar eksik
- hangi alanlar sonradan dolduruldu
- hangi kritik alanlar hala unresolved
- sistemde o kategori icin tarihsel ogrenim var mi

bilgilerini de gorur.

## 2. `cautious` ve `full` Modlari Arasindaki Fark

Ana kaynak:

- `lib/ai-eligibility.ts`
- `lib/analysis-contract.ts`

AI icin 3 mod vardir:

- `skip`
- `cautious`
- `full`

### 2.1 `skip`

Bu modda AI calismaz.
Deterministic fallback ana cikti olur.

### 2.2 `cautious`

Bu modda AI calisir ama ciddi sinirlarla:

- deterministic summary tercih edilir
- narrative expansion kapali
- strengths/weaknesses rewrite kapali
- score override kapali
- max suggestion `3`
- coverage confidence `medium`

Yani model bu modda "ana yorumu degistiren" taraf degil.
Daha cok kontrollu destekleyici cikti uretebilir.

### 2.3 `full`

Bu modda AI daha genis hareket alani kazanir:

- deterministic summary zorunlu referans olmaya devam eder ama narrative expansion aciktir
- strengths/weaknesses rewrite aciktir
- score override sinirli olarak aciktir
- max suggestion `5`
- coverage confidence `high`

Ancak burada bile AI serbest degildir.
Sonuc sanitize ve post-process katmanlarindan gecer.

### 2.4 Mod secimi nasil yapiliyor

AI eligibility icin temel esikler:

- title ve price cekirdek alan kabul edilir
- kritik alan sayisi kontrol edilir
- confidence ortalamasi kontrol edilir
- `extractor_status` kontrol edilir

`full` icin tipik beklenti:

- overall confidence yeterli
- kritik alanlarin buyuk kismi dolu
- kritik alanlarin buyuk kismi yuksek guvenli
- blocking field olmamasi
- extractor status `ok`

`cautious` icin tipik beklenti:

- cekirdek veri var
- ama bazi alanlar orta guvenli
- ya da title/price sinirda kabul edilebilir seviyede

Son karar eligibility ile bitmez.
Contract katmani bir de coverage tier hesaplar:

- `strong`
- `medium`
- `weak`

Coverage `weak` ise AI uygun gorunse bile yine skip olabilir.

## 3. AI Hangi Durumlarda Tamamen Susturuluyor

Ana kaynak:

- `lib/ai-eligibility.ts`
- `lib/analysis-contract.ts`
- `lib/ai-analysis.ts`

AI'nin tamamen susturuldugu temel durumlar:

### 3.1 Extractor blocked ise

`extractor_status === "blocked"`

Bu durumda sistem direkt:

- `eligible: false`
- `mode: skip`

verir.

Neden:
Veri kaynagi kritik seviyede zayif oldugu icin AI'nin yorumu guvenli kabul edilmez.

### 3.2 Title veya price yeterince guvenilir degilse

Ozellikle title ve price cekirdek alan sayilir.

Sistem su durumda AI'yi kapatir:

- title yok veya cok dusuk guvenli
- price yok veya cok dusuk guvenli
- ya da ikisi birlikte yeterli confidence esigini gecemiyorsa

Neden:
Baslik ve fiyat zayifsa urunun ne oldugu ve teklifin ne oldugu net degildir.

### 3.3 Kritik veri kapsami yetersizse

Kritik alanlar:

- `title`
- `price`
- `brand`
- `reviewCount`
- `ratingValue`
- `imageCount`
- `sellerScore`
- `descriptionLength`

Bu alanlardan cok azi doluysa AI kapatilir.

Neden:
Modelin yorum yapacagi zemin yetersizdir.

### 3.4 Genel confidence skoru esigin altindaysa

Consolidated input icindeki field confidence degerlerinden bir ortalama guven skoru uretilir.
Bu skor cok dusukse AI skip olur.

Neden:
Alanlar dolu olsa bile kaynaklar yeterince guvenli degilse modelin anlatimi riskli hale gelir.

### 3.5 Coverage tier `weak` ise

Eligibility tek basina yeterli degildir.
Contract katmani cekirdek coverage'i tekrar olcer.

Eger:

- core field sayisi dusukse
- reliable core field sayisi dusukse
- extractor status zayifsa

coverage `weak` olur ve AI atlanir.

### 3.6 GEMINI API yoksa veya model hata verirse

Ana kaynak:

- `lib/ai-analysis.ts`

Su durumlarda da AI sonucta "susmus" kabul edilir:

- `GEMINI_API_KEY` yok
- model response parse edilemedi
- sanitize asamasindan gecemedi
- exception firlatti

Bu durumda deterministic fallback doner.

### 3.7 Uretilen cikti veri dayanak testinden gecmezse

AI weakness ve suggestion ogeleri `depends_on` alanlari ile gelir.

Sonra sistem bakar:

- bu dependency alanlari gercekten elde var mi
- bu alanlar kullanilabilir veri uretiyor mu

Eger hayirsa ilgili item elenir.
Gerekiyorsa fallback sonuc agirlik kazanir.

Yani AI calissa bile unsupported veya temelsiz yorumlar ciktiya giremeyebilir.

## 4. Son Cikti Nasil Guvenli Kalıyor

AI kullanilsa bile son cikti su filtrelerden gecer:

1. Prompt JSON response ister
2. `depends_on` zorunludur
3. sanitize katmani format ve alan adlarini temizler
4. veri dayanak kontrolu unsupported item'lari atar
5. score drift sinirlanir
6. fallback her zaman hazirdir

Bu nedenle sistemin asil prensibi su:

"AI serbest yorum motoru degil; deterministic omurganin uzerinde kontrollu, veri-bagli ve fallback-guvenceli bir yorum katmanidir."

## 5. Kisa Teknik Ozet

SellBoost AI akisi su mantikla calisir:

- once veri toplanir
- sonra field-level confidence hesaplanir
- sonra deterministic analiz olusur
- sonra AI eligibility ve contract calisir
- sadece yeterli coverage varsa AI devreye girer
- AI cikti uretse bile sanitize edilir
- sorun olursa deterministic fallback korunur

Yani AI burada "karari veren tek motor" degil.
Karar omurgasi deterministic katmandadir; AI kontrollu yorum ve zenginlestirme katmanidir.


