# SellBoost AI Sistem Ozeti

Tarih: `2026-03-28`

## 1. Projenin Amaci

SellBoost AI, e-ticaret urun linklerini ozellikle Trendyol odaginda analiz eden, urunun neden iyi ya da kotu performans gosterdigini veri odakli sekilde yorumlayan ve bunu kullaniciya rapor, skor, aksiyon listesi ve gorsel dashboard olarak sunan bir urun analiz platformudur.

Sistem sadece bir scraper degildir. Asagidaki yetenekleri bir araya getirir:

- Kullanici kaydi ve girisi
- Plan / abonelik mantigi
- Kullaniciya ozel rapor saklama
- Canli analiz calistirma
- Deterministic + AI destekli rapor zenginlestirme
- Favori raporlar
- Rapor export ve yeniden analiz
- Admin yonetim ekranlari
- Trendyol uzmanlik kurallariyla sekillenen karar mantigi

## 2. Teknoloji Yigini

Ana teknoloji bilesenleri:

- `Next.js 16`
- `React 19`
- `TypeScript`
- `NextAuth`
- `Prisma`
- `SQLite`
- `Chart.js`
- `better-sqlite3`
- `bcryptjs`

Temel dosyalar:

- [package.json](/d:/sellboost/package.json)
- [auth.ts](/d:/sellboost/auth.ts)
- [schema.prisma](/d:/sellboost/prisma/schema.prisma)
- [layout.tsx](/d:/sellboost/app/layout.tsx)

## 3. Uygulama Mimarisi

Sistem 3 ana katmanda dusunulebilir:

### 3.1 Pazarlama Katmani

Bu katman landing ve tanitim sayfalarini icerir.

Baslica sayfalar:

- `/`
- `/features`
- `/pricing`
- `/about`
- `/faq`
- `/how-it-works`
- `/iletisim`

Ilgili dosyalar:

- [page.tsx](/d:/sellboost/app/page.tsx)
- [marketing-shell-frame.tsx](/d:/sellboost/app/_ui/marketing-shell-frame.tsx)
- [marketing-shell.html](/d:/sellboost/public/marketing-shell.html)

Bu alan urunun tanitimi, fiyatlandirma ve giris/kayit yonlendirmeleri icin kullanilir.

### 3.2 Workspace / Dashboard Katmani

Bu katman oturum acmis kullanicinin asil urun deneyimidir.

Baslica route'lar:

- `/dashboard`
- `/analyze`
- `/reports`
- `/report/[id]`
- `/account`
- `/settings`

Temel dosyalar:

- [dashboard-shell-frame.tsx](/d:/sellboost/app/_ui/dashboard-shell-frame.tsx)
- [dashboard-shell.html](/d:/sellboost/public/dashboard-shell.html)
- [workspace-routes.ts](/d:/sellboost/lib/workspace-routes.ts)

Burada su ekranlar bulunur:

- Genel Bakis
- Yeni Analiz
- Tum Raporlar
- Favoriler
- Hesabim
- Ayarlar
- Rapor detayi alt sekmeleri

### 3.3 Analiz ve API Katmani

Bu katman veri toplama, alan cikarimi, skor hesaplama, AI zenginlestirme ve rapor saklamadan sorumludur.

Temel dosyalar:

- [run-analysis.ts](/d:/sellboost/lib/run-analysis.ts)
- [build-analysis.ts](/d:/sellboost/lib/build-analysis.ts)
- [prepare-analysis-input.ts](/d:/sellboost/lib/prepare-analysis-input.ts)
- [analysis-contract.ts](/d:/sellboost/lib/analysis-contract.ts)
- [ai-analysis.ts](/d:/sellboost/lib/ai-analysis.ts)

## 4. Auth Sistemi

Kimlik dogrulama `NextAuth` ile saglanir.

Desteklenen auth tipleri:

- Credentials
- Google OAuth
- GitHub OAuth
- Discord OAuth

Ana auth dosyasi:

- [auth.ts](/d:/sellboost/auth.ts)

Session tip genisletmeleri:

- [next-auth.d.ts](/d:/sellboost/types/next-auth.d.ts)

Session icinde tasinan ana alanlar:

- `id`
- `role`
- `plan`
- `name`
- `email`
- `username`

Giris ve kayit sayfalari:

- [page.tsx](/d:/sellboost/app/login/page.tsx)
- [page.tsx](/d:/sellboost/app/register/page.tsx)
- [auth-panel.tsx](/d:/sellboost/app/_ui/auth-panel.tsx)

Kayit akisi artik gercek veriye baglidir. Kullanici kaydinda su alanlar alinabilir:

- Isim
- Soyisim
- Kullanici adi
- E-posta
- E-posta tekrar
- Telefon
- Magaza adi
- Sirket adi
- Sifre

Kayit endpoint'i:

- [route.ts](/d:/sellboost/app/api/register/route.ts)

## 5. Veri Modeli

Prisma semasi:

- [schema.prisma](/d:/sellboost/prisma/schema.prisma)

Ana tablolar:

### 5.1 User

Kullanici temel hesap ve profil alanlarini tutar.

Alanlarin ozeti:

- `id`
- `name`
- `email`
- `username`
- `phone`
- `companyName`
- `storeName`
- `passwordHash`
- `role`
- `plan`
- `createdAt`
- `updatedAt`

### 5.2 Plan

Sistemde kullanilan plan tanimlarini tutar.

Ornek yetenek alanlari:

- aylik analiz limiti
- rapor gecmisi limiti
- export yetkisi
- AI kullanimi
- yeniden analiz yetkisi

### 5.3 Subscription

Kullanicinin aktif plan aboneligi bu tabloda tutulur.

### 5.4 Report

Her analiz sonucu olusan raporun ana kaydidir.

Icerdigi baslica alanlar:

- `url`
- `platform`
- `category`
- `seoScore`
- `conversionScore`
- `overallScore`
- `summary`
- `dataSource`
- `extractedData`
- `derivedMetrics`
- `coverage`
- `accessState`
- `suggestions`
- `priorityActions`
- `analysisTrace`

### 5.5 ReportFavorite

Kullaniciya ozel favori rapor iliskisini tutar.

Bu tablo sayesinde favoriler artik cihaz bazli degil kullanici bazlidir.

### 5.6 LearningMemory

Ogrenme ve gecmis ornek hafizasi gibi kullanilan destek tablosudur.

### 5.7 CategoryBenchmark

Kategori bazli benchmark verilerini saklar.

### 5.8 LearnedRule

Ogrenilen veya uretilen kural bilgisini saklar.

### 5.9 UserUsageRecord / GuestUsageRecord

Kullanim limiti ve sayac takibi icin kullanilir.

## 6. Analiz Akisi

Sistemin cekirdek akisinda genel olarak su adimlar vardir:

1. Kullanici bir urun URL'si girer.
2. URL validasyonu yapilir.
3. Platform tespiti yapilir.
4. HTML veya API tabanli veri toplama yapilir.
5. Alanlar normalize edilir.
6. Alan bazli confidence ve source metadata hesaplanir.
7. Core skorlar uretilir.
8. Gerekliyse AI katmani devreye girer.
9. Sonuc contract'a uygun sekilde normalize edilir.
10. Kullanici planina gore access/sanitize uygulanir.
11. Rapor kaydedilir.
12. Dashboard ve rapor detay ekraninda gosterilir.

Bu akisla ilgili temel dosyalar:

- [run-analysis.ts](/d:/sellboost/lib/run-analysis.ts)
- [build-analysis.ts](/d:/sellboost/lib/build-analysis.ts)
- [prepare-analysis-input.ts](/d:/sellboost/lib/prepare-analysis-input.ts)
- [analysis-access.ts](/d:/sellboost/lib/analysis-access.ts)
- [analysis-trace.ts](/d:/sellboost/lib/analysis-trace.ts)
- [analyze-execution.ts](/d:/sellboost/lib/analyze-execution.ts)
- [analyze-jobs.ts](/d:/sellboost/lib/analyze-jobs.ts)

### 6.1 Asenkron Analyze Queue

Analiz artik sadece tek bir uzun HTTP request olarak calismiyor. Sistem su yapiyi kullaniyor:

1. Frontend `/api/analyze/jobs` ile bir analyze job olusturur.
2. Job kaydi DB'deki `AnalyzeJob` tablosuna yazilir.
3. Ayrik worker process bu kaydi claim eder.
4. Worker `runAnalysisPipeline` uzerinden gercek analizi calistirir.
5. Frontend `/api/analyze/jobs/[id]` endpoint'ini poll ederek durum, progress ve final sonucu okur.

Bu yapi sayesinde:

- route degisimi veya refresh sonrasi job durumu kaybolmaz
- analiz request lifecycle'dan ayrilir
- canli progress gosterimi daha gercek hale gelir
- worker mantigi ileride Redis/BullMQ gibi bir yapiya tasinabilecek sekilde ayrismis olur

Ilgili dosyalar:

- [route.ts](/d:/sellboost/app/api/analyze/jobs/route.ts)
- [route.ts](/d:/sellboost/app/api/analyze/jobs/[id]/route.ts)
- [analyze-job-worker.ts](/d:/sellboost/scripts/analyze-job-worker.ts)
- [dev-full.ts](/d:/sellboost/scripts/dev-full.ts)

## 7. Veri Toplama ve Cikarma Katmani

Sistem farkli seviyelerde veri toplar:

- Sayfa HTML'i
- Gömülü veri bloklari
- Platforma ozel yapilar
- Genel fallback extractor'lar
- Trendyol'a ozel extractor

Ilgili dosyalar:

- [extract-basic-fields.ts](/d:/sellboost/lib/extract-basic-fields.ts)
- [index.ts](/d:/sellboost/lib/extractors/index.ts)
- [trendyol.ts](/d:/sellboost/lib/extractors/platforms/trendyol.ts)
- [fetch-trendyol-api.ts](/d:/sellboost/lib/fetch-trendyol-api.ts)
- [missing-data.ts](/d:/sellboost/lib/missing-data.ts)

Bu katman su tip alanlari cikarmaya calisir:

- urun basligi
- fiyat
- marka
- model kodu
- gorsel sayisi
- aciklama uzunlugu
- rating
- review count
- seller score
- favorite count
- question count
- kargo / iade / kampanya
- diger saticilar

Ek olarak son duzeltmelerle:

- `description_text` ham aciklama metni olarak kayda alinabilir
- Trendyol `Urun Bilgileri` blogundaki sol kolon aciklama, sag kolon ek bilgi/ozellik olarak ayrilir
- `Kuponlar` alanindan `150 TL Kupon` benzeri etiketler extraction katmanina dahil edilir

## 8. Trendyol Uzmanlik Kurallari

Sistem sadece ham veri gostermiyor; Trendyol odakli kural sistemi de kullaniyor.

Baslica dosyalar:

- [trendyol-rulebook.ts](/d:/sellboost/lib/trendyol-rulebook.ts)
- [trendyol-rule-resolution.ts](/d:/sellboost/lib/trendyol-rule-resolution.ts)
- [trendyol-rule-coverage.ts](/d:/sellboost/lib/trendyol-rule-coverage.ts)
- [trendyol-scorecard.ts](/d:/sellboost/lib/trendyol-scorecard.ts)
- [trendyol-shipping.ts](/d:/sellboost/lib/trendyol-shipping.ts)

Bu kural katmani:

- skor agirliklarini
- veri yorumlama bicimini
- trust / demand / content kararlarini
- UI'de gosterilen aciklama dilini
- scorecard mantigini

etkiler.

## 9. AI Katmani

Sistem tamamen AI'a dayali degildir; hibrit bir mimari vardir.

Yapi:

- Deterministic cekirdek hesaplar
- Gerekirse AI enrichment
- Kontrat / eligibility / confidence kontrolleri

Ilgili dosyalar:

- [ai-analysis.ts](/d:/sellboost/lib/ai-analysis.ts)
- [analysis-contract.ts](/d:/sellboost/lib/analysis-contract.ts)
- [analysis-decision-summary-check.ts](/d:/sellboost/scripts/analysis-decision-summary-check.ts)

AI katmani su alanlarda deger katar:

- rapor dilini zenginlestirme
- ozetleme
- aksiyonlari aciklama
- sinyal yorumlama

Ama sistemde AI calismasa bile temel deterministic analiz ayakta kalir.

## 10. Rapor Yonetimi

Rapor sistemi su yeteneklere sahiptir:

- kullaniciya ozel rapor listesi
- rapor detayi
- rapor timeline
- rapor export
- rapor save
- rapor reanalyze
- favori raporlar

Ilgili endpoint ve servisler:

- [route.ts](/d:/sellboost/app/api/reports/list/route.ts)
- [route.ts](/d:/sellboost/app/api/reports/[id]/route.ts)
- [route.ts](/d:/sellboost/app/api/reports/[id]/reanalyze/route.ts)
- [route.ts](/d:/sellboost/app/api/reports/[id]/export/route.ts)
- [route.ts](/d:/sellboost/app/api/reports/save/route.ts)
- [route.ts](/d:/sellboost/app/api/reports/favorites/route.ts)
- [report-list-service.ts](/d:/sellboost/lib/report-list-service.ts)
- [report-detail-query.ts](/d:/sellboost/lib/report-detail-query.ts)

Raporlar session kullanicisinin `userId` bilgisiyle filtrelendigi icin kullaniciya ozeldir.

## 11. Favoriler Sistemi

Favoriler ilk etapta `localStorage` bazliydi. Daha sonra kullanici bazli server storage'a gecirildi.

Mevcut durum:

- Oturumlu kullanici: favoriler DB'de saklanir
- Misafir/fallback durumlari: local fallback davranis korunabilir

Ilgili dosyalar:

- [route.ts](/d:/sellboost/app/api/reports/favorites/route.ts)
- [dashboard-shell.html](/d:/sellboost/public/dashboard-shell.html)

## 12. Dashboard Davranisi

Dashboard icinde iframe tabanli bir shell yapisi kullaniliyor.

Neden:

- Buyuk bir tek sayfa hissi vermek
- Raporlar arasi hizli gecis
- Workspace route'larini merkezi yonetmek

Son durumda su iyilestirmeler uygulanmis durumda:

- Ic navigation'da iframe tekrar yuklenmiyor
- Parent route ile iframe view senkron
- `history.pushState` bazli workspace gecisi
- `postMessage` ile parent-iframe koordinasyonu
- Favoriler / ayarlar / account / reports ayrilmis route mantigi

Temel dosyalar:

- [dashboard-shell-frame.tsx](/d:/sellboost/app/_ui/dashboard-shell-frame.tsx)
- [dashboard-shell.html](/d:/sellboost/public/dashboard-shell.html)

## 13. Profil ve Hesap Bilgisi

Dashboard shell ilk basta sabit demo kullanici metinleri kullaniyordu.

Son durumda:

- Profil kutusu session verisinden besleniyor
- Sidebar'da kullanici adi gosteriliyor
- Ust barda selamlama session kullanicisina gore yaziliyor
- Hesabim ekranindaki ana alanlar session ile senkronize ediliyor
- Cikis aksiyonu gercek NextAuth signout akisina bagli

## 14. Ayarlar Ekrani

`Ayarlar` butonu artik `Hesabim` ile karismiyor. Ayrica `/settings` route'u mevcut.

Dosyalar:

- [page.tsx](/d:/sellboost/app/settings/page.tsx)
- [workspace-routes.ts](/d:/sellboost/lib/workspace-routes.ts)
- [dashboard-shell.html](/d:/sellboost/public/dashboard-shell.html)

## 15. Admin Alani

Admin tarafinda temel yonetim sayfalari mevcut:

- `/admin`
- `/admin/plans`
- `/admin/reports`
- `/admin/system`
- `/admin/users`

Amac:

- kullanicilar
- planlar
- sistem durumu
- raporlar

uzerinde yonetim gorunumu saglamak.

## 16. Kullanim Limiti ve Plan Sistemi

Plan ve kullanim mantigi sistemin ticari omurgasidir.

Ilgili dosyalar:

- [resolve-plan.ts](/d:/sellboost/lib/resolve-plan.ts)
- [plans.ts](/d:/sellboost/lib/plans.ts)
- [report-history-limit.ts](/d:/sellboost/lib/report-history-limit.ts)
- [usage-route-response.ts](/d:/sellboost/lib/usage-route-response.ts)
- [increment-analyze-usage.ts](/d:/sellboost/lib/increment-analyze-usage.ts)
- [check-analyze-limit.ts](/d:/sellboost/lib/check-analyze-limit.ts)

Bu katman su kararlar icin kullanilir:

- kullanicinin free mi premium mu oldugu
- aylik analiz limiti
- rapor gecmisi limiti
- export yetkisi
- yeniden analiz yetkisi
- advanced AI erisimi

## 17. Test ve Dogrulama Sistemi

Projede klasik tek tip test yapisi yerine script tabanli contract/regression kontrol sistemi var.

Ornek script aileleri:

- auth config ve callback testleri
- reports paging ve route contract testleri
- analysis contract testleri
- AI decision testleri
- analyze response testleri
- report detail / export / reanalyze contract testleri
- stabilization checklist
- readiness suite

Tum bunlar [package.json](/d:/sellboost/package.json) icindeki `scripts` altinda toplanmistir.

Bu yapi, urunun davranisini contract bazli korumak icin guclu bir omurga saglar.

## 18. Notlar ve Diger Dokumanlar

Repo icinde bircok isletim ve analiz notu bulunuyor:

- gunluk notlar
- commit planlari
- rule matrix notlari
- deployment notlari
- analiz akis raporlari

Ornekler:

- [GUNLUK_NOT_2026-03-28.md](/d:/sellboost/GUNLUK_NOT_2026-03-28.md)
- [PROJECT_STATUS_2026-03-24.md](/d:/sellboost/PROJECT_STATUS_2026-03-24.md)
- [TRENDYOL_SKOR_MIMARISI_VE_VERI_STRATEJISI_RAPORU.md](/d:/sellboost/TRENDYOL_SKOR_MIMARISI_VE_VERI_STRATEJISI_RAPORU.md)
- [VERCEL_DEPLOYMENT.md](/d:/sellboost/VERCEL_DEPLOYMENT.md)

## 19. Mevcut Durum Ozeti

Su anki proje durumu yuksek seviyede soyle:

- Gercek auth altyapisi var
- Kullanici bazli rapor sistemi var
- Kullanici bazli favoriler var
- Dashboard shell ile zengin workspace deneyimi var
- Anasayfadaki URL giris alani gercek analyze queue akisina bagli
- Analyze queue + worker mimarisi mevcut
- Trendyol odakli extractor ve rule engine var
- AI destekli ama deterministic temeli koruyan analiz mimarisi var
- Admin ve plan altyapisi mevcut
- Test ve readiness scriptleri guclu

Bu proje artik MVP seviyesini asmis, urunlesmeye dogru giden bir analiz platformu karakteri tasiyor.

## 20. Onerilen Sonraki Buyuk Isler

Sistemin bugunku yapisina gore mantikli sonraki is basliklari:

- `Hesabim` ekranindaki tum alanlari gercek DB verisiyle iki yonlu sync etmek
- Kayit sirasinda toplanan `storeName/companyName/phone` alanlarini profile edit akisina da baglamak
- Dashboard shell icindeki demo kalan metinleri tamamen temizlemek
- E2E auth + favorite + report navigation smoke test seti eklemek
- Plan bazli UI kilitlerini daha gorunur hale getirmek
- Export / reanalyze / account update akislarina daha cok canli dogrulama eklemek
