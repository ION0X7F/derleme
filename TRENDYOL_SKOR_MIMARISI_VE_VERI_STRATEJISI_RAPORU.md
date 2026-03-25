# Trendyol Skor Mimarisi ve Veri Stratejisi Raporu

Tarih: 25 Mart 2026

Bu belge, Trendyol odakli analiz urununun mevcut skor mantigini, elimizdeki gercek verileri, eksik kalan alanlari ve yeni skor mimarisi onerilerini tek yerde toplar.

## 1. Yonetici Ozeti

Mevcut sistem, teknik olarak guclu bir extraction ve analysis altyapisina sahip olsa da skor mantigi bir noktaya kadar genel web SEO mantigina yaklasiyor. Inceledigimiz Trendyol kaynaklari ise platformun asil olarak su eksenlerde calistigini gosteriyor:

- gorunurluk
- donusum
- musteri memnuniyeti
- operasyon kalitesi
- reklam destekli buyume
- karlilik

Bu nedenle urunun ana skor yapisi, klasik "SEO skoru" etrafinda degil, Trendyol ici performans mantigina gore yeniden cercevelenmelidir.

Ana sonuc:

- `SEO Skoru` tek basina dogru merkez degil
- `Trendyol Arama Gorunurlugu`, `Donusum Potansiyeli`, `Guven/Operasyon`, `Ticari Potansiyel` daha dogru katmanlar
- veri olmayan alanlar uydurulmamalidir
- buna karsin bazi alanlar acik formullerle turetilmelidir
- turetilen her metrik "gercek veri" gibi degil, "sinyal / potansiyel / risk" gibi isimlendirilmelidir

## 2. Trendyol Kaynaklarindan Cikan Ana Kurallar

Incelenen Trendyol ve Trendyol odakli metinlerden cikan ortak tema su:

### 2.1 Gorunurlugu etkileyen ana sinyaller

- satis hacmi
- donusum orani
- urun puani
- yorum sayisi
- favorilenme
- urun ozellik dolulugu
- dogru marka ve kategori
- baslik kalitesi
- urun gorselleri
- fiyat ve avantaj etiketi
- kargo hizi
- satici puani
- reklam etkilesimi

### 2.2 Satisi etkileyen ana sinyaller

- fiyat
- indirim / kupon / kampanya
- urun bilgisi ve ikna gucu
- gorsel kalitesi
- yorumlar ve puan
- satici guveni
- teslimat hizi
- iade ve operasyon kalitesi
- musteri sorularina hizli donus

### 2.3 Algoritmanin sevme ihtimali yuksek olan urun profili

- satan
- memnuniyet yaratan
- guven veren
- hizli teslim edilen
- iyi puan alan
- reklamla desteklendiginde donusen

Bu nedenle Trendyol mantigi "salt SEO" degil, "gorunurluk + donusum + operasyon + guven + reklam verimi" butunudur.

## 3. Mevcut Skor Mantiginda Sorunlu Noktalar

### 3.1 SEO Skoru fazla genel web SEO mantigina yaklasiyor

Bugune kadar baktigimiz alanlarin bir kismi Trendyol icin yardimci olsa da merkeze alinmamasi gerekir:

- `meta_description`
- klasik `h1`
- `description_length`

Baslik ve urun adinin guclu olmasi onemlidir; fakat Trendyol ici arama icin meta description gibi alanlar ikincil kalir.

### 3.2 Aciklama uzunlugu tek basina anlamli degil

Sorun:

- uzunluk kalite degildir
- uzun aciklama satmaz, dogru aciklama satar
- Trendyol mantiginda asil mesele icerik yeterliligi ve urun bilgi dolulugudur

Dogru yaklasim:

- `description_length` ancak yardimci sinyal olmali
- ana sinyal `icerik yeterliligi` olmali

### 3.3 Veri olmayan alanlara gercek metric gibi davranma riski var

Su alanlar elimizde yokken "gercek" gibi sunulmamalidir:

- gercek satis adedi
- gercek donusum orani
- gercek tiklanma
- gercek goruntulenme
- gercek sepete ekleme
- gercek reklam performansi
- gercek iade orani

Bu alanlar ancak entegrasyon veya panel verisi ile dogrudan bilinebilir.

## 4. Su An Dogrudan Eristigimiz Veriler

Guclu veri alanlari:

- urun basligi
- cozulmus ana baslik
- marka
- kategori
- fiyat
- indirim orani
- gorsel sayisi
- aciklama varligi
- teknik ozellik varligi
- soru sayisi
- favori sayisi
- yorum sayisi
- puan
- yildiz dagilimi
- satici adi
- satici puani
- resmi satici
- ucretsiz kargo
- teslimat suresi
- iade/kargo bilgi varligi
- kampanya/promosyon etiketleri
- diger saticilar ve bazi rakip fiyat bilgileri
- stok durumu sinyali

Bu alanlarla guclu bir "listeleme + guven + teklif + ilgi" modeli kurulabilir.

## 5. Kismi Erisilen Alanlar

- icerik kalitesi
- gorsel kalitesi
- aciklama yeterliligi
- rekabet baskisi
- buyume firsati
- satis durumu
- fiyat avantaji

Bu alanlarin bir kismi gercek alanlardan turetilebilir ama tamami dogrudan okunmuyor.

## 6. Su An Erisemedigimiz Kritik Alanlar

En kritik eksikler:

- gercek satis hacmi
- gercek donusum orani
- gercek goruntulenme
- gercek tiklanma
- sepete ekleme verisi
- reklam etkilesimi
- reklam harcamasi
- ROAS / reklam verimi
- gercek iade orani
- gercek iptal orani
- soru cevaplama suresi
- paketleme puani
- ceza puani
- magazanin panel bazli operasyon puanlari
- kar marji / karlilik

Bu nedenle tam anlamiyla "Trendyol algoritma skoru" su an kurulamaz; ancak guclu bir proxy sistem kurulabilir.

## 7. Uretmemiz Gereken ve Uretmememiz Gereken Veriler

### 7.1 Uretilmesi mantikli veriler

Bu alanlar, mevcut sinyallerden turetilebilir:

- `Talep Sinyali`
- `Donusum Potansiyeli`
- `Arama Gorunurlugu Skoru`
- `Guven / Operasyon Riski`
- `Buyume Firsati`

Bunlar:

- acik formulle hesaplanmali
- kaynak guveniyle agirliklanmali
- "gercek" degil "turetilmis" olarak yorumlanmali

### 7.2 Uretilmemesi gereken veriler

Bunlar uydurulmamalidir:

- gercek satis adedi
- gercek donusum orani
- gercek goruntulenme
- gercek tiklanma
- gercek reklam geliri
- gercek iade orani

Bu alanlar yoksa "bilinmiyor" kalmalidir.

## 8. Yeni Skor Mimarisi Onerisi

### 8.1 Arama Gorunurlugu Skoru

Amac:

- Trendyol ici arama ve listeleme gucunu olcmek

Onerilen alt sinyaller:

- baslik kalitesi
- marka / kategori dogrulugu
- urun ozellik dolulugu
- gorsel yeterliligi
- fiyat avantaji / avantaj etiketi
- favori sayisi
- yorum sayisi
- puan
- trafik / reklam yardimci sinyalleri varsa ek katki

Onerilen agirlik:

- baslik: `%15`
- marka / kategori dogrulugu: `%10`
- ozellik dolulugu: `%20`
- gorsel yeterliligi: `%10`
- fiyat / avantaj etiketi: `%15`
- favori: `%10`
- yorum + puan: `%15`
- yardimci trafik / reklam: `%5`

### 8.2 Donusum Potansiyeli

Amac:

- urunu goren kisinin satin alma ihtimaline yakin bir sinyal uretmek

Onerilen alt sinyaller:

- puan
- yorum sayisi
- aciklama yeterliligi
- gorsel yeterliligi
- fiyat
- ucretsiz kargo
- teslimat suresi
- soru-cevap
- satici guveni

Onerilen agirlik:

- puan: `%15`
- yorum sayisi: `%10`
- aciklama yeterliligi: `%10`
- gorsel: `%10`
- fiyat: `%15`
- ucretsiz kargo: `%10`
- teslimat suresi: `%10`
- soru-cevap: `%5`
- satici guveni: `%15`

### 8.3 Guven / Operasyon Skoru

Amac:

- algoritma ve musteri tarafinda guven yaratan veya kiran sinyalleri toplamak

Onerilen alt sinyaller:

- satici puani
- resmi satici
- iade bilgisi
- kargo bilgisi
- teslimat suresi
- stok surekliligi / stok riski
- yorum kalitesi
- negatif tema baskisi

Onerilen agirlik:

- satici puani: `%25`
- resmi satici: `%10`
- iade / kargo bilgi netligi: `%15`
- teslimat suresi: `%15`
- stok riski: `%10`
- yorum guveni: `%15`
- operasyonel riskler: `%10`

### 8.4 Ticari Potansiyel Skoru

Amac:

- urunun buyutulebilir ve karli yone cekilebilir olup olmadigini anlamak

Onerilen alt sinyaller:

- fiyat avantaji
- kampanya uygunlugu
- favori / ilgi
- mevcut satis durumu proxy'si
- buyume firsati
- rekabet baskisi
- reklamla desteklenebilirlik

Onerilen agirlik:

- fiyat avantaji: `%20`
- kampanya uygunlugu: `%10`
- favori / ilgi: `%20`
- satis durumu proxy: `%15`
- buyume firsati: `%15`
- rekabet baskisi: `%10`
- reklam potansiyeli: `%10`

### 8.5 Genel Skor

Onerilen ust seviye birlesim:

- Arama Gorunurlugu: `%30`
- Donusum Potansiyeli: `%30`
- Guven / Operasyon: `%25`
- Ticari Potansiyel: `%15`

## 9. Matematiksel Cerceve

Bu skorlar "sezgisel yorum" ile degil, normalize edilmis formullerle kurulmalidir.

### 9.1 Kural 1

Her sinyal once normalize edilir:

- 0-100 bandi
- gerekiyorsa log veya threshold kullanilir

### 9.2 Kural 2

Her sinyalin kaynak guveni ayrica hesaba katilir:

- yuksek guven = tam katki
- orta guven = azaltilmis katki
- dusuk guven = sinirli katki
- yok = notr

### 9.3 Kural 3

Turetilmis metrikler acik formulle hesaplanir.

Ornek:

`Talep Sinyali = 0.35*favori + 0.30*yorum + 0.15*soru + 0.20*puan`

Bu sadece ornek bir iskelet olup kategoriye gore kalibre edilmelidir.

### 9.4 Kural 4

Sonuc once sayisal skor, sonra etiket olur:

- `0-39`: dusuk
- `40-69`: orta
- `70-100`: guclu

Bu esikler sahadaki testlerle guncellenmelidir.

## 10. Gercek Saticilarla Test Zorunlulugu

Bu skorlar laboratuvar ortaminda guzel gorunse bile tek basina yeterli degildir.

Mutlaka yapilmasi gerekenler:

1. Mantik testi
- farkli urunlerde skor sezgisel olarak dogru mu?

2. Satici dogrulamasi
- gercek satis yapan magazalar bu urun icin "evet bu urun guclu / zayif" diyor mu?

3. Korelasyon testi
- yuksek uretilmis skorlar gercek satis, gorunurluk veya donusum ile iliskili mi?

Test sorulari:

- yuksek `Talep Sinyali` olan urunler gercekte daha cok ilgi cekiyor mu?
- yuksek `Donusum Potansiyeli` olan urunler daha iyi satiyor mu?
- yuksek `Arama Gorunurlugu` olan urunler daha iyi gorunuyor mu?

Bu testler olmadan skor "yardimci sistem" olur ama "dogrulanmis karar sistemi" olmaz.

## 11. Kisa Karar Listesi

Netlestirilen kararlar:

- `SEO Skoru` adi yeterli degil
- yerine `Arama Gorunurlugu Skoru` gelmeli
- `meta_description` yardimci sinyal olmali
- `description_length` ana sinyal olmamali
- `urun ozellik dolulugu` agirligi yukselmeli
- `yorum`, `puan`, `favori`, `fiyat`, `kargo`, `satici puani` merkeze alinmali
- operasyon kalitesi ayri skor olarak dusunulmeli
- veri olmayan alanlar uydurulmamalidir
- bazi kritik metrikler acik formulle turetilmelidir
- tum model gercek saticilarla test edilmelidir

## 12. Onerilen Siradaki Adimlar

1. `SEO Skoru` ismini ve anlamini yeniden tanimla
2. mevcut sinyalleri yeni 4 ana skor altinda yeniden grupla
3. her skor icin acik matematik formulu yaz
4. turetilmis ve gercek verileri UI'da acik sekilde ayir
5. 10-20 gercek Trendyol urununde kalibrasyon yap
6. mumkunse satis yapan magazalarla saha geri bildirimi topla

Bu raporun ana tavsiyesi:

SellBoost, "genel SEO analiz araci" gibi degil, "Trendyol gorunurluk ve satis performansi karar sistemi" gibi konumlanmalidir.

