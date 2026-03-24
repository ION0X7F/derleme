type GuardResult =
  | {
      allowed: true;
      release: () => void;
    }
  | {
      allowed: false;
      reason: string;
      retryAfterSeconds: number;
    };

type GuardEntry = {
  startedAt: number;
  expiresAt: number;
};

const ACTIVE_WINDOW_MS = 25_000;
const COOLDOWN_WINDOW_MS = 8_000;

const guardStore = new Map<string, GuardEntry>();

function now() {
  return Date.now();
}

function cleanupExpiredEntries(currentTime: number) {
  for (const [key, value] of guardStore.entries()) {
    if (value.expiresAt <= currentTime) {
      guardStore.delete(key);
    }
  }
}

function buildKey(params: { actor: string; url: string }) {
  const canonicalUrl = canonicalizeUrlForAnalysisKey(params.url);
  return `${params.actor}::${canonicalUrl}`.toLocaleLowerCase("tr-TR");
}

export function beginAnalyzeRequestGuard(params: {
  actor: string;
  url: string;
}): GuardResult {
  const current = now();
  cleanupExpiredEntries(current);

  const key = buildKey(params);
  const existing = guardStore.get(key);

  if (existing && existing.expiresAt > current) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.expiresAt - current) / 1000)
    );
    return {
      allowed: false,
      reason:
        "Ayni URL icin cok hizli tekrar analyze cagrisi algilandi. Kisa sure sonra tekrar deneyin.",
      retryAfterSeconds,
    };
  }

  guardStore.set(key, {
    startedAt: current,
    expiresAt: current + ACTIVE_WINDOW_MS,
  });

  return {
    allowed: true,
    release: () => {
      const latest = guardStore.get(key);
      if (!latest) return;

      const releaseTime = now();
      const activeElapsed = releaseTime - latest.startedAt;
      const cooldown =
        activeElapsed < 2_000 ? COOLDOWN_WINDOW_MS : Math.floor(COOLDOWN_WINDOW_MS / 2);

      guardStore.set(key, {
        startedAt: latest.startedAt,
        expiresAt: releaseTime + cooldown,
      });
    },
  };
}
import { canonicalizeUrlForAnalysisKey } from "@/lib/url-canonical";
