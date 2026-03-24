export type TrendyolUrlCase = {
  key: string;
  bucket:
    | "strong"
    | "weak-content"
    | "missing-data-risk"
    | "seller-trust-risk"
    | "low-image"
    | "weak-description"
    | "variant-heavy"
    | "edge-case";
  url: string;
  note: string;
};

/**
 * Manual stabilization URL pool for periodic smoke checks.
 * These URLs are intentionally lightweight and Trendyol-only.
 */
export const TRENDYOL_URL_TEST_SET: TrendyolUrlCase[] = [
  {
    key: "iphone-16-pro-max",
    bucket: "strong",
    url: "https://www.trendyol.com/apple/iphone-16-pro-max-256gb-siyah-titanyum-p-857296077",
    note: "Genellikle güçlü veri kapsaması ve yüksek yorum hacmi.",
  },
  {
    key: "xiaomi-buds",
    bucket: "variant-heavy",
    url: "https://www.trendyol.com/xiaomi/redmi-buds-6-play-siyah-kulakici-kulaklik-gurultu-onleme-bt5-4-ios-android-xiaomi-tr-garantili-p-855229295?boutiqueId=61",
    note: "Varyant ve kampanya sinyali yüksek ürün örneği.",
  },
  {
    key: "caykur-cay",
    bucket: "weak-description",
    url: "https://www.trendyol.com/caykur/rize-turist-cay-500gr-p-4409228",
    note: "Kategoriye göre içerik derinliği dalgalanabilir.",
  },
  {
    key: "atlas-book",
    bucket: "weak-content",
    url: "https://www.trendyol.com/cocuk-akademi/7-den-70-e-turkiye-atlasi-p-937160613?boutiqueId=61",
    note: "Metin/görsel sinyalleri sınırlı olabilen bir ürün tipi.",
  },
  {
    key: "running-shoe",
    bucket: "low-image",
    url: "https://www.trendyol.com/zbclub/beyaz-unisex-running-sneaker-ayakkabi-p-1118369786",
    note: "Görsel ve satıcı güven sinyalleri değişken ürün örneği.",
  },
  {
    key: "iphone-16e",
    bucket: "seller-trust-risk",
    url: "https://www.trendyol.com/apple/iphone-16e-128gb-siyah-p-900754126",
    note: "Rakip/satıcı farkı nedeniyle güven-tema testleri için uygun.",
  },
  {
    key: "short-or-redirect-risk",
    bucket: "edge-case",
    url: "https://www.trendyol.com/",
    note: "Ürün sayfası olmayan edge case: URL doğrulama/akıș kırılma testi.",
  },
  {
    key: "single-seller-risk",
    bucket: "missing-data-risk",
    url: "https://www.trendyol.com/xiaomi/redmi-buds-6-play-siyah-kulakici-kulaklik-gurultu-onleme-bt5-4-ios-android-xiaomi-tr-garantili-p-855229295",
    note: "Soru sayısı/diğer satıcı verisi eksikliği gözlenebilen case.",
  },
];

