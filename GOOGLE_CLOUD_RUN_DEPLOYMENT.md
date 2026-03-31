# Google Cloud Run Deployment

Bu proje icin en guvenli uretim akisi:

- Uygulama: Google Cloud Run
- Veritabani: Turso/libSQL
- Secret yonetimi: Cloud Run environment variables veya Secret Manager
- Domain: Global external Application Load Balancer uzerinden custom domain

## Neden bu yol

- Proje yerelde `file:` tabanli SQLite ile calisiyor, ancak Cloud Run instance diskleri kalici degil.
- Kod tabani zaten `libsql` adapter destegi iceriyor; bu nedenle Turso/libSQL uretim icin en dusuk riskli secenek.
- Cloud Run'in dogrudan domain mapping ozelligi preview durumunda; uretim icin onerilen yol load balancer.

## 1. Gerekli araclar

- Google Cloud SDK (`gcloud`)
- Faturalandirmasi aktif bir Google Cloud project
- Turso veya baska bir libSQL veritabani
- Yonetebildigin bir domain

## 2. Uretim veritabani

Yerel `DATABASE_URL=file:...` degerini uretimde kullanma.

Uretimde su tarz bir baglanti kullan:

- `DATABASE_URL=libsql://<db-name>-<org>.turso.io`
- `DATABASE_AUTH_TOKEN=<turso-token>`

Gerekirse yerelde bir kez schema uygula:

```bash
npm run db:push
```

## 3. Cloud Run icin gerekli env'ler

Minimum:

- `AUTH_SECRET`
- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN`

Opsiyonel ama buyuk ihtimalle gerekli:

- `GEMINI_API_KEY`
- `UNLIMITED_USER_EMAILS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`
- `GITHUB_ID`
- `GITHUB_SECRET`
- `NEXT_PUBLIC_GITHUB_AUTH_ENABLED`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXT_PUBLIC_DISCORD_AUTH_ENABLED`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_TEAM`
- `NEXTAUTH_URL`

## 4. Cloud Run deploy

Bu repoda `Dockerfile` hazir. `gcloud` kurduktan sonra tipik akis:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy sellboost ^
  --source . ^
  --region europe-west1 ^
  --platform managed ^
  --allow-unauthenticated ^
  --set-env-vars NODE_ENV=production,NEXTAUTH_URL=https://YOUR_CLOUD_RUN_URL
```

Ilk deploy sonrasinda diger secret/env degerlerini Cloud Run uzerinden eklemek daha guvenlidir.

Alternatif olarak Console uzerinden da ayni servis olusturulabilir.

## 5. Deploy sonrasi zorunlu ayarlar

- Cloud Run servis URL'sini not et.
- `NEXTAUTH_URL` degerini gercek public URL ile guncelle.
- OAuth callback URL'lerini yeni domaine gore guncelle.
- Stripe webhook endpoint'ini yeni domaine gore guncelle:
  - `https://<domain>/api/stripe/webhook`

## 6. Domain baglama

Uretim icin onerilen yol:

- Global external Application Load Balancer
- Backend olarak Cloud Run servisi
- Managed SSL certificate
- Domain DNS kayitlarini load balancer IP'sine yonlendirme

Kisa akis:

1. Cloud Run servisini yayina al.
2. HTTPS load balancer olustur.
3. Backend service olarak Cloud Run servisini sec.
4. Managed certificate olustur ve domaini ekle.
5. DNS tarafinda A/AAAA veya CNAME kayitlarini Google'in verdigi hedefe yonlendir.
6. SSL aktif olduktan sonra uygulamada `NEXTAUTH_URL` ve OAuth callback'lerini final domain ile guncelle.

## 7. Canliya alma checklist'i

Deploy sonrasi su dosyalari kullan:

- `DEPLOY_CHECKLIST_2026-04-01.md`
- `HANDOFF_2026-04-01.md`
- `RELEASE_INDEX_2026-04-01.md`

## 8. Bu makinede mevcut durum

- Repo Cloud Run icin containerize edildi.
- `gcloud` bu makinede kurulu degil.
- Bu nedenle deploy komutlarini burada dogrudan calistiramadim.
- Domain baglama icin Google Cloud Console veya `gcloud` ile devam etmek gerekiyor.
