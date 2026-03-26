# Günlük Not (26 Mart 2026)

## Bugün Ne Yaptık?

Bugün sistemi tekrar gerçek veriye yaklaştırmak için iki ana alanda çalıştık:

1. Veri çekme katmanı (Trendyol + Python fallback)
2. Dashboard kart ve grafik bağları (demo yerine canlı veri)

---

## 1) Veri Çekme Katmanı

### Katmanlı akış netleştirildi
- Önce hızlı ana kaynaklar (extractor + API + runtime) kullanılıyor.
- Eksik kalan alanlar varsa Python fallback devreye giriyor.
- Python’dan gelen veri sadece boş alanları dolduruyor, dolu alanları ezmiyor.

### Trendyol extractor iyileştirmeleri
- `merchant_id` HTML’den güvenli şekilde çıkarılacak hale getirildi.
- `follower_count` için selector + HTML fallback eklendi.
- Satıcı takipçi sayısı için Trendyol follower endpoint entegrasyonu eklendi.

### Python ile tamamlanan alanlar
- `original_price`, `discount_rate`, `qa_snippets`, `question_count`,
  `other_sellers_count`, `other_seller_offers`, `other_sellers_summary`,
  `similar_product_candidates` gibi alanlarda eksiklerin tamamlandığı görüldü.

### Bilinçli olarak devre dışı bırakılan alanlar
- `search_snippet_fallback`
- `model_code`
- `mpn`, `mpn_source`
- `gtin`, `gtin_source`

Bu alanlar ürün karar akışında kritik olmadığı için sadeleştirme amacıyla devre dışı bırakıldı.

---

## 2) Dashboard Bağlantıları

### Rapor detay ekranı
- Fiyat/rakip kartları gerçek veriye bağlı çalışır hale getirildi.
- Kampanya dönüşüm senaryosu kartı dinamik hesapla güncelleniyor.
- Özet sekmesindeki sabit grafikler gerçek rapor datasından türetilen dinamik hesaplara taşındı.

### Overview ekranı
- Overview artık canlı rapor listesinden besleniyor.
- KPI kutuları (ortalama skor, toplam rapor, veri tamamlanma, bekleyen aksiyon) dinamik hesaplanıyor.
- Overview grafiklerinin tamamı gerçek raporlardan üretiliyor:
  - Aylık analiz aktivitesi
  - Skor dağılımı
  - Sayfa gücü
  - Müşteri güveni
  - Pazar konumu
  - Ana zorluklar
- “Son Raporlar” ve “Tüm Raporlar” tabloları canlı rapor listesiyle render ediliyor.

---

## Test / Durum

- `npm run build` başarılı geçti.
- Veri yoksa demo fallback korunuyor.
- Veri varsa canlı veri öncelikli kullanılıyor.

---

## Sonraki Adım Önerisi

- Overview’deki “Ana Zorluklar” ve “Pazar Konumu” formüllerini eski kural setindeki ağırlıklarla birebir eşleştirebiliriz.
- Böylece hem sayı hem yorum katmanı tamamen kurallarla tutarlı olur.
