export function getPlanLabel(plan?: string | null) {
  const normalized = plan?.toLowerCase();

  if (normalized === "guest") return "Guest";
  if (normalized === "free") return "Ucretsiz";
  if (normalized === "pro" || normalized === "premium") return "Pro";
  if (normalized === "pro_monthly") return "Pro Aylik";
  if (normalized === "pro_yearly") return "Pro Yillik";
  if (normalized === "team") return "Ekip / Ajans";
  if (normalized === "enterprise") return "Enterprise";

  return plan || "Bilinmiyor";
}
