# Release Readiness

Bu kontrol, analiz motorunun "urunlesmeye gec" seviyesine ulasip ulasmadigini olcebilir hale getirir.

## Komut

```bash
npm run test:release-readiness
```

Toplu kalite kapisi icin:

```bash
npm run test:readiness-suite
```

Release oncesi tam kapi (build + suite) icin:

```bash
npm run test:pre-release
```

Bu suite sirayla su kontrolleri calistirir:

- `test:auth-config`
- `test:auth-callback`
- `test:stabilization-checklist`
- `test:release-readiness`

## Senaryolar

- strong: guclu veri, AI full beklenir
- medium: orta veri, AI cautious beklenir
- weak: zayif veri, AI skip beklenir
- missing: eksik veri, AI skip ve temkinli cikti beklenir

## Cikti

Komut JSON ciktisi su alanlari verir:

- `readiness`: `go_productization` veya `continue_quality_loop`
- `scenarios`: her senaryoda AI modu, coverage tier ve check sonucu
- `failedCount`: basarisiz kontrol adedi

## Karar Kurali

- `failedCount === 0`: urunlesme fazina gecilebilir
- `failedCount > 0`: kalite/test/prompt tuning turuna devam edilmeli
