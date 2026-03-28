# Trendyol Tab Rule Matrix

Tarih: 26 Mart 2026

Bu dosya, dashboard sekmelerindeki kartlarin hangi not/kural kaynagindan beslendigini tek yerde toplar.

Temel prensip:

- Notlarda acik kural varsa sistem o kurala uyar.
- Notlarda acik kural yoksa mevcut legacy davranis korunur.
- Yeni tarihli notlar varsayilan olarak eskiyi silmez; once ekleme mi celiski mi olduguna bakilir.
- Yeni not eski kurala ek yapiyorsa iki kural birlikte yasar.
- Sadece acik celiski varsa daha yeni olan baskin alinir.
- Tahmini metrikler gercek veri gibi sunulmaz.
- Urun geneli ve satici ozeli sinyaller karistirilmaz.

## Kaynak Onceligi

1. `TRENDYOL_UZMANLIK_KURALLARI.md`
2. `TRENDYOL_SKOR_MIMARISI_VE_VERI_STRATEJISI_RAPORU.md`
3. `GRAFIK_VERI_ESLESTIRME_NOTLARI.md`
4. `docs/demand-capture-diagnosis.md`
5. `docs/seo-rule-engine.md`
6. `24 Mart` tarihli destek ve durum notlari
7. Acik kural yoksa mevcut kod davranisi

## Fiyat & Rakip

| Kart / Blok | Kural Kaynagi | Durum | Not |
|---|---|---|---|
| Mevcut Fiyat | Grafik Veri Eslestirme | Acik kural var | Dogrudan gercek veri |
| Eski Fiyat | Grafik Veri Eslestirme | Acik kural var | Dogrudan gercek veri |
| Rakip Ortalama Fiyat | Grafik Veri Eslestirme | Acik kural var | Ayni urun rakipleri oncelikli |
| Daha Uygun Teklif | Uzmanlik + Grafik Eslestirme | Acik kural var | Ayni urun/benzer urun ayrimi korunmali |
| Fiyat Konumu | Grafik Veri Eslestirme + Uzmanlik | Acik kural var | Ayni urun ve diger saticilar karismamali |
| Kampanya Donusum Senaryosu | Grafik Veri Eslestirme | Acik kural zayif | Tahmini kart olarak kalmali |
| Rakip Fiyat Dagilimi | Uzmanlik + UI duzeltmeleri | Acik kural var | Min/max own+competitors birlikte hesaplanmali |
| Rakip Avantajlari | Uzmanlik + Grafik Eslestirme | Acik kural var | Kampanya/teslimat/indirim sinyalleri gercek veriden |

## Icerik & SEO

| Kart / Blok | Kural Kaynagi | Durum | Not |
|---|---|---|---|
| Birincil Anahtar Kelimeler | Uzmanlik + SEO Rule Engine | Acik kural var | Algoritmik cikarim, AI zorunlu degil |
| Anahtar Kelime Siralamasi | Uzmanlik | Acik kural var | Canli kontrol cache ile korunmali |
| Urun / Kategori Uyumu | Uzmanlik | Acik kural var | Baslik, kategori ve anahtar kelime ortusmesi |
| Aciklama Yeterliligi | Uzmanlik + Skor Mimarisi + SEO Rule Engine | Acik kural var | Uzunluk tek basina yeterli degil |
| Gorsel Sayisi | Grafik Veri Eslestirme | Acik kural var | Dogrudan gercek veri |
| Teknik Alan / Listeleme Uyum Orani | Uzmanlik + SEO Rule Engine | Acik kural var | Teknik alan, SSS, kategori ve aciklama birlikte okunmali |
| Icerik Kalite Radar | Grafik Veri Eslestirme | Acik kural var | Eksenler kural bazli, not yoksa legacy korunur |

## Guven & Yorum

| Kart / Blok | Kural Kaynagi | Durum | Not |
|---|---|---|---|
| Urun Puani | Uzmanlik + Grafik Veri Eslestirme | Acik kural var | Genel urun puani satici puani gibi okunamaz |
| Yorum Hacmi | Grafik Veri Eslestirme | Acik kural var | Dogrudan gercek veri |
| Satici Guveni | Uzmanlik + Grafik Veri Eslestirme | Acik kural var | Satici puani ve satici yorum ortalamasi ayri |
| Iade Durumu | Grafik Veri Eslestirme | Acik kural var | Varsa goster, yoksa kesin hukum verme |
| Yorum Dagilimi | Uzmanlik + Grafik Veri Eslestirme | Acik kural var | Veri yoksa chart cizilmez |
| Yorum Artis Trendi | Uzmanlik + Grafik Veri Eslestirme | Acik kural var | Tarihsel veri yoksa uydurulmaz |
| Yorum Temalari | Uzmanlik | Acik kural var | Urun temalari ve satici operasyon temalari ayrilmali |
| Guven Boyutlari | Skor Mimarisi | Acik kural var | Proxy eksenler durust adlandirilmali |
| Son 10 Yorum | Uzmanlik | Acik kural var | Yildiz + kisa yorum, orneklenmis veri olarak okunur |

## Talep Sinyalleri

| Kart / Blok | Kural Kaynagi | Durum | Not |
|---|---|---|---|
| Talep Sinyali | Uzmanlik + Skor Mimarisi + Demand Diagnosis | Acik kural var | Dogrudan sinyal -> destek sinyali -> dengeleyici |
| Tahmini Aylik Satis Hacmi | Uzmanlik + Skor Mimarisi + Grafik Veri Eslestirme | Acik kural var | Tahmini metrik, gercek satis gibi sunulmaz |
| Ticari Ivme | Uzmanlik | Acik kural var | Kupon, kampanya, hizli teslimat, ucretsiz kargo vb. |
| Pazar Konumu | Uzmanlik + Grafik Veri Eslestirme | Acik kural var | Kesin pazar payi gibi okunmamali |
| Buyume Firsati | Skor Mimarisi | Acik kural var | Turetilmis firsat metriyi |
| Pazar Ilgisi | Grafik Veri Eslestirme | Acik kural var | Favori, yorum, soru, goruntuleme birlikte |
| Ilgi -> Satis Hunisi | Grafik Veri Eslestirme | Acik kural var | Gercek funnel degil, tahmini donusum akisi |
| Pazar Genel Degerlendirme | Uzmanlik | Acik kural var | Tahmini ve gercek dil ayrimi zorunlu |

## Aksiyonlar

| Kart / Blok | Kural Kaynagi | Durum | Not |
|---|---|---|---|
| Oncelikli Aksiyon Listesi | Uzmanlik | Acik kural var | Dayanak veri, oncelik ve etki seviyesi zorunlu |
| AI Geri Bildirimi | Uzmanlik | Acik kural var | Ogrenme dongusu ile uyumlu |
| Aksiyon Oncelik Matrisi | Uzmanlik | Acik kural var | Oncelik kurali varsa kullan, yoksa legacy korunur |
| Tahmini Skor Iyilesmesi | Skor Mimarisi | Acik kural var | Abartili etki dili kullanilmamali |

## Uygulama Notu

Bu matris bir davranis kilavuzudur. Merkezi kod karsiligi `lib/trendyol-rulebook.ts` icinde tutulur.
Kart -> section -> explicit rule gorunurlugu icin teknik eslesme listesi `lib/trendyol-rule-coverage.ts` icinde tutulur.
Kapsama ozeti ve acikta kalan kartlar debug icin `/api/dev/trendyol-rulebook` ciktisinda gorunur.
Ayni ciktida `recommendedCoverageWork` alani, explicit rule'a baglanmamis kartlar icin onerilen uygulama sirasini dondurur.

Bu matrisin mevcut durumunda sadece `Kampanya Donusum Senaryosu` karti bilincli olarak legacy birakilmistir.

Eksik kural durumunda:

- yeni kural uydurulmaz
- mevcut calisan davranis korunur
- kart tahmini ise bunu adinda veya notunda belirtir
