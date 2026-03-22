# Vercel Deployment

Bu proje yerelde `file:` tabanli SQLite ile calisir. Vercel uzerinde kalici kullanim icin `Turso/libSQL` tavsiye edilir.

## Gerekli environment variable'lar

- `AUTH_SECRET`: Auth.js oturum gizli anahtari
- `DATABASE_URL`: Yerelde `file:./dev.db`, uretimde `libsql://...`
- `DATABASE_AUTH_TOKEN`: Turso veya libSQL token'i
- `GEMINI_API_KEY`: Istege bagli. Yoksa analiz motoru deterministic fallback ile calisir
- `UNLIMITED_USER_EMAILS`: Istege bagli, virgul ile ayrilmis email listesi

## Onerilen kalici akis

1. GitHub reposunu Vercel'e import et.
2. Uretim veritabani olarak bir Turso veritabani olustur.
3. Vercel Project Settings > Environment Variables altina:
   - `AUTH_SECRET`
   - `DATABASE_URL`
   - `DATABASE_AUTH_TOKEN`
   - gerekiyorsa `GEMINI_API_KEY`
   degerlerini ekle.
4. Yerelde ayni veritabani bilgileriyle bir kez:
   - `npm run db:push`
   - `npm run db:seed`
   komutlarini calistir.
5. Vercel'de `main` branch'i production branch olarak kullan.

## Guncelleme akisi

- `main` branch'e her push production deploy'u gunceller.
- Diger branch'lere her push preview deployment olusturur.
- Boylece hem kalici canli linkin olur, hem de degisiklikleri once preview URL'de gorebilirsin.
