# Duman Testi Kontrol Listesi

Tarih: 24 Mart 2026

Bu belge, release oncesi manuel kontrol edilmesi gereken temel ekranlari ve akislarini listeler.

## A. Kritik Uretim Akislari

Bu bolum ilk kontrol edilmesi gereken alanlardir.

### 1. Ana sayfa

- `/` aciliyor mu
- URL giris alani gorunuyor mu
- mobilde tasma var mi
- analiz CTA'leri calisiyor mu

### 2. Analyze akisi

- `/analyze` aciliyor mu
- Trendyol URL girisi yapilabiliyor mu
- bos URL durumunda hata mesaji mantikli mi
- gecersiz URL durumunda hata mesaji mantikli mi
- gecerli URL ile analiz akisi basliyor mu
- loading durumu gorunuyor mu
- limit / throttle hatalari kullaniciya anlasilir gidiyor mu

Not:
Bu ekran su anda placeholder durumunda. Uretim akis testi icin once gercek UI'ya donusturulmesi gerekir.

### 3. Reports list

- `/reports` aciliyor mu
- bos liste durumu var mi
- raporlar listeleniyor mu
- detay sayfasina gecis var mi
- paging / cursor mantigi beklendigi gibi mi

Not:
Bu ekran su anda placeholder durumunda.

### 4. Report detail

- `/reports/[id]` aciliyor mu
- rapor verisi yukleniyor mu
- timeline sadece istendiginde geliyor mu
- erisim seviyesi dusuk kullanicida kilitli bolumler dogru mu
- 404 ve yetkisiz durumlari duzgun mu

Not:
Bu ekran su anda placeholder durumunda.

### 5. Export

- `/reports/[id]/export` aciliyor mu
- export oncesi gereksiz timeline yuklenmiyor mu
- export API compact/full modlari dogru mu

Not:
Bu ekran placeholder tabanli, ancak timeline=0 kontrati duzeltildi.

### 6. Reanalyze

- rapordan yeniden analiz tetiklenebiliyor mu
- onceki rapor ezilmeden yeni versiyon olusuyor mu
- timeline zinciri dogru guncelleniyor mu

Bu akis backend tarafinda daha olgun, UI tarafi ayrica kontrol edilmeli.

## B. Kimlik ve Uyelik Akislari

### 1. Login

- `/login` aciliyor mu
- credentials formu var mi
- varsa Google butonu env durumuna gore dogru gorunuyor mu
- callback sonrasi yonlendirme guvenli mi

Not:
Bu ekran su anda placeholder durumunda.

### 2. Register

- `/register` aciliyor mu
- form validation dogru mu
- kayit sonrasi beklenen yonlendirme calisiyor mu

Not:
Bu ekran su anda placeholder durumunda.

### 3. Account

- `/account` aciliyor mu
- plan/limit/uyelik bilgileri gorunuyor mu
- gecersiz oturum durumunda yonlendirme veya hata mantikli mi

Not:
Bu ekran su anda placeholder durumunda.

## C. Yonetim Akislari

### 1. Admin ana ekran

- `/admin` erisim kontrolu dogru mu
- admin olmayan kullanici engelleniyor mu

Not:
Bu ekran su anda placeholder durumunda.

### 2. Admin alt ekranlari

- `/admin/users`
- `/admin/plans`
- `/admin/reports`
- `/admin/system`

Kontrol:

- route aciliyor mu
- yetki kontrolu var mi
- bos/hata durumlari mantikli mi

Not:
Bu ekranlar placeholder durumunda.

## D. Bilgilendirme ve Marketing Sayfalari

Su sayfalar placeholder ise SEO ve urun anlatimi acisindan ayrica ele alinmali:

- `/about`
- `/faq`
- `/features`
- `/pricing`
- `/fiyatlandirma`
- `/hakkimizda`
- `/how-it-works`
- `/iletisim`
- `/gizlilik-politikasi`
- `/kullanim-kosullari`

## E. Hata ve Sistem Durumlari

- global error ekrani
- dashboard error ekrani
- loading ekrani
- not-found ekrani

Bu ekranlar da placeholder tabanli oldugu icin son tasarim oncesi tekrar ele alinmali.

## Sonuc

Backend ve kontrat seviyesinde guclu bir temel var.

Ancak manuel smoke testin tam anlamiyla degerli olabilmesi icin asagidaki ekranlarin placeholder olmaktan cikmasi gerekir:

- analyze
- login
- register
- reports
- report detail
- account
- dashboard
- admin


