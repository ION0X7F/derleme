# SellBoost Tasarim Brifi

Bu belge, disaridan alinacak tasarim destegi icin hizli proje ozeti sunar.

## 1. Site / Urun Tipi

SellBoost, Trendyol saticilari icin urun URL'sinden satis analizi yapan bir SaaS urunudur.

Temel kullanim:

- kullanici Trendyol urun linki verir
- sistem urun verisini toplar
- urunun neden satmadigini veya nerede zayif kaldigini analiz eder
- AI destekli ama deterministic omurgali bir karar cikisi uretir
- raporlar kaydedilir, tekrar gorulebilir, export/reanalyze akislarina baglanir

## 2. Hedef Kitle

Birincil hedef kitle:

- Trendyol saticilari
- e-ticaret yoneticileri
- pazar yeri operasyon ekipleri
- ajanslar / coklu urun yoneten ekipler

Ikincil hedef kitle:

- urun sayfasi optimizasyonu yapan danismanlar
- performans / buyume ekipleri

## 3. Urun Vaadi

Ana vaat:

"Trendyol urun sayfasinin neden iyi veya kotu performans gosterdigini, aciklanabilir ve aksiyona donuk sekilde gostermek."

One cikan fark:

- sadece skor gostermek degil
- ana darbozagi adlandirmak
- fiyat, teslimat, guven, yorum, icerik ve rekabet sinyallerini birlikte okumak
- AI'yi kontrolsuz yorumcu degil, guvenli yardimci katman olarak kullanmak

## 4. Stil / Konumlanma

Kesin tasarim kararini urun sahibi verecek.
Bu nedenle bu dosya yon verici ama baglayici olmayan bir ton onerir:

- modern
- guven veren
- karar destek urunu hissi tasiyan
- veriyi "rapor" gibi degil "aksiyon paneli" gibi gosteren
- B2B SaaS ciddiyetini koruyan

Kacinilmasi iyi olur:

- fazla oyuncakli / startup klişe gorunum
- kontrol paneli yerine blog hissi
- asiri karmaşık veri gosterimi

## 5. Mevcut Icerik Kaynaklari

Tasarim icin kullanilabilecek mevcut metin kaynagi:

- `tasarim/icerik/site.ts`
- `tasarim/README.md`
- `tasarim/PROJECT_STATUS_2026-03-24.md`

Ozellikle `site.ts` icinde:

- navigation
- landing benefit metinleri
- feature gruplari
- nasil calisir adimlari
- pricing planlari
- FAQ maddeleri

yer alir.

## 6. Marka Materyali Durumu

Su anda repo icinde net bir marka paketi gorunmuyor:

- resmi logo yok
- net brand guideline yok
- sabit renk sistemi net degil

Bu nedenle tasarim calismasi sirasinda:

- logo ihtiyaci
- ana/yardimci renkler
- tipografi sistemi

ayrica tanimlanabilir.

## 7. Gorsel Durumu

Repo icinde anlamli urun gorseli / fotograf paketi bulunmuyor.

`tasarim/gorseller/` klasorunde su anda yalnizca mevcut public asset kopyalari var.
Bunlar daha cok placeholder seviyesinde kabul edilmeli.

## 8. Teknik Bilgiler

Stack:

- Next.js App Router
- TypeScript
- Prisma
- NextAuth

Tasarim acisindan onemli not:

- ekranlarin bir kismi halen placeholder
- urun sahibi musteri neyi nerede gorecek kararlarini kendisi verecek
- bu nedenle tasarim calismasi "hazir veri ekranini giydirmekten" cok "urun yuzeyini sekillendirmek" niteliginde olabilir

## 9. Sayfa / Yuzey Tipleri

Projede tasarima konu olabilecek ana yuzeyler:

- landing / ana sayfa
- features
- how it works
- pricing
- faq
- login / register
- analyze
- reports list
- report detail
- account
- dashboard
- admin yuzeyleri

## 10. Mobil Uyumluluk

Evet, mobil uyumlu olmasi bekleniyor.

Ancak urun bir karar paneli oldugu icin:

- desktop-first dusunulebilir
- mobile experience sadeleştirilmis ama islevsel olmali
- ozellikle analyze ve report detail ekranlarinda bilgi hiyerarsisi kritik

## 11. Tasarimci Icin Onerilen Baslangic Noktasi

Ilk tasarim sprinti icin en mantikli yuzeyler:

1. landing page
2. analyze ekran konsepti
3. report detail ekran konsepti
4. login/register

Sebep:

- urunun ne sattigi
- nasil calistigi
- analiz degerinin nasil sunulacagi

en hizli bu yuzeylerde netlesir.
