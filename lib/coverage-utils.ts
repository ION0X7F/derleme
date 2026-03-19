export const coverageFieldLabels: Record<string, string> = {
  title: "Title",
  h1: "H1",
  meta_description: "Meta aciklama",
  brand: "Marka",
  product_name: "Urun adi",
  model_code: "Model kodu",
  normalized_price: "Normalize fiyat",
  original_price: "Eski fiyat",
  discount_rate: "Indirim orani",
  image_count: "Gorsel sayisi",
  has_video: "Video",
  rating_value: "Puan",
  review_count: "Yorum sayisi",
  question_count: "Soru sayisi",
  description_length: "Aciklama uzunlugu",
  bullet_point_count: "Madde sayisi",
  has_shipping_info: "Kargo bilgisi",
  has_free_shipping: "Ucretsiz kargo",
  shipping_days: "Teslim suresi",
  has_return_info: "Iade bilgisi",
  has_specs: "Teknik ozellikler",
  has_faq: "SSS",
  variant_count: "Varyant sayisi",
  stock_status: "Stok durumu",
  seller_name: "Satici",
  seller_badges: "Satici rozetleri",
  seller_score: "Satici puani",
  follower_count: "Takipci sayisi",
  other_sellers_count: "Diger satici sayisi",
  other_sellers_summary: "Rakip ozeti",
  has_brand_page: "Marka sayfasi",
  official_seller: "Resmi satici",
  has_campaign: "Kampanya",
  campaign_label: "Kampanya etiketi",
  delivery_type: "Teslimat tipi",
};

export function getCoverageLabel(confidence?: "high" | "medium" | "low") {
  if (confidence === "high") return "Yuksek kapsam";
  if (confidence === "medium") return "Orta kapsam";
  return "Sinirli kapsam";
}

export function formatCoverageFields(fields: string[], limit = 10) {
  return fields
    .slice(0, limit)
    .map((field) => coverageFieldLabels[field] || field)
    .join(", ");
}
