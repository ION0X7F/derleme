type OtherSellersSummary = {
  count: number;
  scored_count: number;
  avg_score: number | null;
  top_score: number | null;
  official_count: number;
  fast_delivery_count: number;
  high_follower_count: number;
  seller_names: string[];
};

export function getCompetitorSummaryLabel(
  summary?: OtherSellersSummary | null
) {
  if (!summary || typeof summary.count !== "number" || summary.count <= 0) {
    return null;
  }

  const parts: string[] = [`${summary.count} rakip satici`];

  if (typeof summary.avg_score === "number") {
    parts.push(
      `ort. ${summary.avg_score.toLocaleString("tr-TR", {
        minimumFractionDigits: summary.avg_score % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
      })} puan`
    );
  }

  if (summary.fast_delivery_count > 0) {
    parts.push(`${summary.fast_delivery_count} hizli teslimat`);
  }

  if (summary.official_count > 0) {
    parts.push(`${summary.official_count} resmi satici`);
  }

  return parts.join(", ");
}

export function getCompetitorPressureLabel(
  summary?: OtherSellersSummary | null
) {
  if (!summary || typeof summary.count !== "number" || summary.count <= 0) {
    return null;
  }

  if (
    summary.count >= 4 &&
    ((typeof summary.avg_score === "number" && summary.avg_score >= 8.5) ||
      summary.fast_delivery_count >= 2)
  ) {
    return "Rekabet baskisi yuksek";
  }

  if (summary.count >= 2) {
    return "Rakip baskisi var";
  }

  return "Rekabet sinirli";
}

export function getCompetitorNarrative(params: {
  summary?: OtherSellersSummary | null;
  sellerScore?: number | null;
  hasFreeShipping?: boolean;
  shippingDays?: number | null;
  deliveryType?: string | null;
}) {
  const { summary, sellerScore, hasFreeShipping, shippingDays, deliveryType } = params;

  if (!summary || typeof summary.count !== "number" || summary.count <= 0) {
    return null;
  }

  const parts: string[] = [];

  if (summary.count >= 4) {
    parts.push("Bu urunde satici rekabeti yuksek gorunuyor.");
  } else if (summary.count >= 2) {
    parts.push("Bu urunde birden fazla satici bulundugu icin ayrisma ihtiyaci var.");
  } else {
    parts.push("Rakip satici baskisi sinirli gorunuyor.");
  }

  if (
    typeof sellerScore === "number" &&
    typeof summary.avg_score === "number" &&
    summary.avg_score - sellerScore >= 0.5
  ) {
    parts.push("Rakip tarafta guven seviyesi daha yuksek algilanabilir.");
  }

  if (
    summary.fast_delivery_count >= 2 &&
    hasFreeShipping !== true &&
    (!deliveryType || deliveryType === "standard" || (typeof shippingDays === "number" && shippingDays >= 6))
  ) {
    parts.push("Teslimat avantajinda rakip taraf daha guclu olabilir.");
  }

  if (
    summary.official_count > 0 &&
    typeof sellerScore !== "number"
  ) {
    parts.push("Rakip tarafta resmi magaza veya guven sinyali daha gorunur olabilir.");
  }

  return parts.join(" ");
}
