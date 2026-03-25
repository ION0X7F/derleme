# Trendyol Uzmanlık Kuralları

Bu dosya, Trendyol ürün analizi yapan AI katmanının kalıcı uzmanlık hafızasıdır.

Amaç:
- Aynı hataların tekrar edilmesini önlemek
- Ürün, satıcı, yorum, soru ve talep sinyallerini tutarlı yorumlamak
- Tahmini veriler ile gerçek verileri net ayırmak
- Analist AI ve Denetçi AI için ortak kural tabanı sağlamak

## 1. Temel Prensipler

1. `Null` veri, `0` veri değildir.
2. Sayfada görünmeyen badge, ilgili metriğin sıfır olduğu anlamına gelmez.
3. Gerçek veri ile tahmini veri asla aynı dilde sunulmaz.
4. Ürün geneli ile satıcı özeli karıştırılmaz.
5. Tek satıcılı ve çok satıcılı ürünler farklı mantıkla değerlendirilir.
6. AI, veri olmayan yerde kesin hüküm vermez.
7. Tahmini metrikler mutlaka `tahmini`, `sinyal`, `potansiyel`, `risk`, `fırsat` gibi isimlerle sunulur.

## 2. Tek Satıcılı / Çok Satıcılı Kuralı

### Tek satıcılı ürün

- Ürün puanı, büyük ölçüde o satıcının da performansını yansıtır.
- Ürün yorumları satıcıya daha doğrudan yazılabilir.
- Soru-cevap havuzu ürün ve satıcı için ortak kabul edilebilir.

### Çok satıcılı ürün

- Genel ürün puanı, ürün kalitesi sinyalidir.
- Satıcıya ait yorumlar ayrı okunmalıdır.
- `Bu satıcıdan alanlar` filtresi varsa ayrıca değerlendirilmelidir.
- Ürün yorumu ile satıcı operasyon performansı birbirine karıştırılmaz.

## 3. Yorum Analizi Kuralları

### Genel ürün analizi

Amaç:
- Ürünün genel kabulünü anlamak
- Ürün bazlı güçlü/zayıf yönleri görmek
- Aylık yorum akışını incelemek
- Yıldız dağılımını analiz etmek
- Ürün bazlı olumlu/olumsuz temaları çıkarmak

Örnek kullanım:
- Ürün kalitesi
- Beklenti farkı
- Fonksiyon sorunu
- Malzeme kalitesi

### Satıcı özel analiz

Amaç:
- Satıcıya özgü sorunları görmek
- Paketleme, hasar, teslimat, iade, yanlış ürün gibi operasyonel sinyalleri ayırmak

Örnek kullanım:
- Geç kargo
- Hasarlı teslimat
- Eksik ürün
- Yanlış ürün
- Yanıtsız soru

## 4. Soru-Cevap Kuralları

### Genel ürün soru havuzu

- Ürünün müşterilerde ne kadar soru oluşturduğunu gösterir.
- Karar aşamasındaki belirsizlikleri yansıtır.
- İçerik eksiklerini bulmak için değerlidir.

### Satıcı özel soru havuzu

- Bu satıcıya gelen soru baskısını gösterir.
- Yanıt kalitesi ve yanıt hızı açısından değerlidir.

### Kritik kural

- `Soru yok` ile `soru verisi yok` aynı değildir.
- `Yanıtsız soru` metriği aksiyon üretimi için çok değerlidir.

## 5. Talep Sinyali Kuralları

### Doğrudan talep sinyalleri

En güçlü katman:
- `X günde satıldı`
- `X kişinin sepetinde`
- `X kişi favoriledi`
- `Son 24 saatte X kişi görüntüledi`

Kural:
- Bunlar varsa ayrı ayrı puanlanır.
- Biri varsa katkı verir, yoksa `null` kalır.
- Hepsi yoksa sistem durmaz, destekleyici sinyallere düşer.

### Destekleyici talep sinyalleri

- Yorum sayısı
- Yorum artış trendi
- Ürün puanı
- Soru sayısı
- Satıcıya gelen soru sayısı

### Ticari ivme sinyalleri

- Kupon
- Tükeniyor
- Hızlı teslimat
- Başarılı satıcı
- Çok satan rozeti
- Ücretsiz kargo
- Kampanya etiketi

### Dengeleyiciler

- Satıcı puanı
- İade bilgisi
- Teslimat gücü
- Kötü yorum oranı
- Satıcı özel negatif şikayetler

### Talep metrik isimlendirme kuralı

Gerçek sayı yoksa şu isimler kullanılabilir:
- Talep Sinyali
- Kategori Satış Tahmini
- Ticari İvme
- Büyüme Fırsatı
- Pazar Konumu

Şu isimler gerçek veri yoksa kullanılmamalı:
- Kesin satış adedi
- Kesin dönüşüm oranı
- Kesin görüntülenme hacmi
- Kesin reklam performansı

## 6. İçerik ve Arama Görünürlüğü Kuralları

Trendyol içi görünürlük için öncelik:
- Başlık uyumu
- Anahtar kelime uyumu
- Ürün/kategori uyumu
- Açıklama yeterliliği
- Görsel yeterliliği
- Teknik özellik alanı
- Soru-cevap desteği

### Düşük öncelikli klasik web sinyalleri

- Meta description
- Klasik HTML SEO etiketleri

Bunlar yardımcı olabilir ama Trendyol içi görünürlükte birincil sinyal değildir.

## 7. Aksiyon Üretim Kuralları

AI aksiyon üretirken:
- Eksik alanı somut söylemeli
- Dayanak veriyi belirtmeli
- Tahmini etkiyi abartmamalı
- Önceliği veri dayanağına göre vermeli
- Aynı öneriyi farklı kelimelerle tekrarlamamalı

### Her aksiyon için beklenen alanlar

- Başlık
- Kısa açıklama
- Dayanak veri
- Neden öncelikli
- Beklenen etki seviyesi

## 8. Yasaklı Davranışlar

AI şunları yapamaz:
- `Badge görünmüyor` diye `0 satış` demek
- Genel ürün puanını her durumda satıcı puanı gibi yorumlamak
- Tek satıcılı / çok satıcılı ayrımını yok saymak
- Tahmini metrikleri gerçek veri gibi anlatmak
- Veri olmayan alanda kesin yargı vermek
- Kategori ortalaması olmayan yerde uydurma kategori ortalaması yazmak

## 9. Güven Seviyesi Kuralları

### Yüksek güven

- Doğrudan sayfada görünen ve net parse edilen veri
- Açık yıldız dağılımı
- Açık yorum sayısı
- Açık satıcı puanı
- Açık badge metni

### Orta güven

- Birden fazla sinyalden türetilmiş ama veri tabanı güçlü metrik
- Kategori karşılaştırma tahmini
- Talep skoru

### Düşük güven

- Veri eksikliği yüksek
- Yalnızca proxy sinyale dayanan yorum
- Kategori/ürün semantik değerlendirmesinde zayıf dayanak

## 10. Öğrenme Döngüsü

Her kullanıcı düzeltmesi aşağıdaki sınıflardan biri olarak kaydedilir:
- Kural düzeltmesi
- Veri yorumlama düzeltmesi
- İsimlendirme düzeltmesi
- Öncelik düzeltmesi
- Tahmin/gerçek ayrımı düzeltmesi

Bu kayıtlar sonraki analizlerde AI'a örnek olarak sunulur.
