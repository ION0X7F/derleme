export function getPlanLabel(plan?: string | null) {
  const normalized = plan?.toLowerCase();

  if (normalized === "guest") return "Guest";
  if (normalized === "free") return "Free";
  if (normalized === "pro" || normalized === "premium") return "Pro";
  if (normalized === "enterprise") return "Enterprise";

  return plan || "Bilinmiyor";
}
