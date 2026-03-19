type UsageStatusParams = {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  type?: "user" | "guest";
  planLabel?: string;
};

export type UsageStatus = {
  percent: number;
  tone: "good" | "warn" | "danger";
  badge: string;
  shortMessage: string;
  detailMessage: string;
  upgradeMessage: string | null;
};

export function getUsageStatus({
  used,
  limit,
  remaining,
  allowed,
  type,
  planLabel,
}: UsageStatusParams): UsageStatus {
  const percent = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;

  if (!allowed || remaining <= 0) {
    return {
      percent,
      tone: "danger",
      badge: "Limit doldu",
      shortMessage: "Bu ayki analiz hakkin bitti.",
      detailMessage: `${used} / ${limit} analiz kullanildi. Yeni donem baslayana kadar analiz kilitli.`,
      upgradeMessage:
        type === "guest"
          ? "Giris yaparak daha fazla Trendyol raporu acabilirsin."
          : planLabel === "Pro"
            ? null
            : "Pro pakete gecerek aylik limiti ve premium rapor derinligini artirabilirsin.",
    };
  }

  if (remaining <= 2 || percent >= 80) {
    return {
      percent,
      tone: "warn",
      badge: "Limit yaklasiyor",
      shortMessage: `Son ${remaining} analiz hakkin kaldi.`,
      detailMessage: `${used} / ${limit} analiz kullanildi. Kalan hakki kritik seviyeye yaklasti.`,
      upgradeMessage:
        type === "guest"
          ? "Free uyelik ile daha fazla rapor ve kayit gecmisi acilir."
          : planLabel === "Pro"
            ? null
            : "Pro pakete gecerek limit stresi olmadan daha fazla Trendyol analizi yapabilirsin.",
    };
  }

  return {
    percent,
    tone: "good",
    badge: "Kullanim aktif",
    shortMessage: "Analiz hakkin aktif.",
    detailMessage: `${used} / ${limit} analiz kullanildi. ${remaining} analiz hakkin kaldi.`,
    upgradeMessage:
      type === "guest"
        ? "Giris yaparsan daha uzun rapor gecmisi ve daha fazla analiz hakkina ulasirsin."
        : planLabel === "Pro"
          ? null
          : "Pro pakette daha derin AI raporu, export ve daha yuksek aylik limit acilir.",
  };
}
