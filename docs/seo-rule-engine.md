# SEO Rule Engine

Bu katman AI serbest yorumuna dayanmaz. Baslik, aciklama ve kelime uyumu icin rule-based bir cekirdek kullanir.

## Output Semasi

```ts
{
  score: number;
  level: "strong" | "medium" | "weak" | "unclear";
  title_length: number;
  title_quality_score: number | null;
  title_quality_reasons: string[];
  description_quality_score: number | null;
  description_quality_reasons: string[];
  keyword_alignment_score: number | null;
  keyword_alignment_reasons: string[];
  originality_risk_level: "low" | "medium" | "high" | "unclear";
  originality_risk_reasons: string[];
  seo_issues: Array<{
    key: string;
    severity: "high" | "medium" | "low";
    title: string;
    reason: string;
  }>;
  seo_recommendations: Array<{
    key: string;
    priority: "high" | "medium" | "low";
    title: string;
    reason: string;
  }>;
  seo_confidence: "high" | "medium" | "low" | "unclear";
}
```

## Rule Listesi

### 1. Title analysis

Ana sinyaller:
- uzunluk
- marka varligi
- urun tipinin netligi
- hedef kelime kapsami
- tekrar orani
- jenerik ifade yogunlugu

Agirlik mantigi:
- ideal uzunluk: yuksek pozitif etki
- marka varligi: orta pozitif etki
- urun tipi netligi: orta-yuksek pozitif etki
- keyword coverage: orta-yuksek pozitif etki
- duplicate/jenerik ifade: negatif etki

### 2. Description analysis

Ana sinyaller:
- uzunluk
- madde yapisi
- yapisal zenginlik
- hedef kelime kapsami
- tekrar orani
- jenerik kaliplar

Agirlik mantigi:
- uzunluk ve yapi: guclu pozitif etki
- bullet coverage: orta-guclu pozitif etki
- duplicate/jenerik ifade: guclu negatif etki

### 3. Keyword alignment

Ana mantik:
- title coverage %55 agirlik
- description coverage %45 agirlik

Sebep:
- ana niyetin baslikta gorunmesi daha kritik
- aciklama ise destekleyici ikinci katman

### 4. Originality risk

Bu alan:
- kesin plagiarism detection degildir
- metin benzerligi ve jeneriklik riskidir

Ana sinyaller:
- duplicate ratio
- jenerik phrase hit sayisi
- yapisal farklilastirici unsurlar
- bullet yapisi

### 5. Issue severity ve recommendation priority

- `high`
  - eksik baslik
  - eksik aciklama
  - cok zayif title/description
  - zayif keyword alignment
- `medium`
  - orta seviye title/description
  - bullet yapisinin zayifligi
  - orta originality riski
- `low`
  - iyilestirilebilir ama kritik olmayan dil/yapi sorunlari

Oneriler dogrudan issue'lardan turetilir; generic tavsiye uretmez.

## Beklenen Davranis Ornekleri

1. Guclu baslik + zengin aciklama + iyi kelime uyumu
- score yuksek
- issue az
- recommendation az

2. Baslik guclu ama aciklama cok kisa
- title iyi
- description zayif
- aciklama genisletme oncelikli oneridir

3. Baslikta marka yok, urun tipi belirsiz
- title quality duser
- baslik yeniden kurma onerisi gelir

4. Aciklama uzun ama tekrarli ve jenerik
- description score duser
- originality risk orta/yuksek olabilir
- "kesin intihal" denmez

5. Keyword verildi ama baslikta ve aciklamada zayif
- keyword alignment dusuk
- kelimeyi dogal sekilde guclendir onerisi cikar

6. Bullet point yok ama aciklama orta uzunlukta
- description orta kalir
- ozellikleri madde madde ayirma onerisi gelir

7. Sadece baslik var, aciklama yok
- seo_confidence low
- aciklama eksik issue'su high severity olur

8. Baslik ve aciklama yok
- score 0
- level unclear
- seo_confidence unclear

## Temkinli Kullanilan Alanlar

- `originality_risk_level`
  - kesin intihal sonucu degildir
- `keyword_alignment_score`
  - sadece verilen hedef keyword uzerinden hesaplanir
- `seo_confidence`
  - veri kapsamasi hakkindadir, ticari basari garantisi degildir
