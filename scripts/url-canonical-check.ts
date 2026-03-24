import {
  canonicalizeUrlForAnalysisKey,
  dedupeUrlsByCanonical,
} from "../lib/url-canonical";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function run() {
  const checks: Check[] = [];

  const canonical = canonicalizeUrlForAnalysisKey(
    "http://www.Trendyol.com/marka/urun-p-123?boutiqueId=1#frag"
  );
  checks.push({
    label: "canonicalization normalizes protocol, host and strips query/hash",
    passed: canonical === "https://trendyol.com/marka/urun-p-123",
    detail: canonical,
  });

  const canonicalTrailingSlash = canonicalizeUrlForAnalysisKey(
    "https://trendyol.com/marka/urun-p-123/"
  );
  checks.push({
    label: "canonicalization removes trailing slash",
    passed: canonicalTrailingSlash === "https://trendyol.com/marka/urun-p-123",
    detail: canonicalTrailingSlash,
  });

  const deduped = dedupeUrlsByCanonical([
    "https://www.trendyol.com/marka/urun-p-123?boutiqueId=1",
    "https://trendyol.com/marka/urun-p-123?boutiqueId=2",
    "https://trendyol.com/marka/urun-p-124",
  ]);
  checks.push({
    label: "dedupe collapses canonical duplicates only",
    passed:
      deduped.unique.length === 2 &&
      deduped.duplicatesCollapsed === 1 &&
      deduped.unique[0] === "https://www.trendyol.com/marka/urun-p-123?boutiqueId=1" &&
      deduped.unique[1] === "https://trendyol.com/marka/urun-p-124",
    detail: deduped,
  });

  const failed = checks.filter((item) => !item.passed);

  console.log(
    JSON.stringify(
      {
        total: checks.length,
        passed: checks.length - failed.length,
        failed: failed.length,
        checks,
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

run();
