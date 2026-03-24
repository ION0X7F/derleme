# SellBoost UI Gap Priority

Tarih: 24 Mart 2026

Bu belge, placeholder durumda kalan ekranlari urun onceligine gore siralamak icin hazirlandi.

## P0 - Urun kullanilabilirligi icin once yapilmasi gerekenler

Bu ekranlar tamamlanmadan urun akisinin tam oldugunu soylemek zor:

1. `app/analyze/page.tsx`
2. `app/reports/page.tsx`
3. `app/reports/[id]/page.tsx`
4. `app/login/page.tsx`
5. `app/register/page.tsx`

Gerekce:

- kullanici analiz baslatamiyor
- kayit/giris akisinda gercek urun deneyimi yok
- uretilen raporu listeleme ve gorme deneyimi eksik

## P1 - Kullanici kaliciligi ve yonetim icin kritik olanlar

1. `app/account/page.tsx`
2. `app/dashboard/page.tsx`
3. `app/admin/page.tsx`
4. `app/admin/users/page.tsx`
5. `app/admin/plans/page.tsx`
6. `app/admin/reports/page.tsx`
7. `app/admin/system/page.tsx`

Gerekce:

- kullanici planini ve limitlerini goremez
- operasyonel yonetim yuzeyi tamam degil

## P2 - Destekleyici ama ertelenebilir ekranlar

1. `app/reports/[id]/export/page.tsx`
2. `app/report/[id]/page.tsx`
3. `app/report/[id]/export/page.tsx`
4. bilgilendirme ve marketing sayfalari

Gerekce:

- urun cekirdegi kadar acil degil
- placeholder ile gecici olarak var olabilir

## Onerilen Uygulama Sirasi

1. Analyze
2. Login/Register
3. Reports list
4. Report detail
5. Account
6. Dashboard
7. Admin
8. Marketing ve destek sayfalari

## Pratik Sonuc

Bir sonraki en mantikli gelistirme gorevi:

`app/analyze/page.tsx` ekranini gercek urun akisina cevirip `/api/analyze` ile baglamak.
