import { validateProductUrl } from "../lib/url-validation";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function run() {
  const checks: Check[] = [];

  const valid = validateProductUrl(
    "https://www.trendyol.com/marka/urun-adi-p-123456789",
    {
      allowedPlatforms: ["trendyol"],
      allowShortTrendyolLinks: false,
    }
  );
  checks.push({
    label: "valid trendyol product url passes",
    passed: valid.ok === true && valid.platform === "trendyol",
    detail: valid,
  });

  const shortLink = validateProductUrl("https://ty.gl/abc123", {
    allowedPlatforms: ["trendyol"],
    allowShortTrendyolLinks: false,
  });
  checks.push({
    label: "short trendyol link rejected when disabled",
    passed: shortLink.ok === false && shortLink.code === "URL_INVALID",
    detail: shortLink,
  });

  const local = validateProductUrl("http://localhost:3000/test", {
    allowedPlatforms: ["trendyol"],
    allowShortTrendyolLinks: false,
  });
  checks.push({
    label: "localhost rejected",
    passed: local.ok === false && local.code === "URL_INVALID",
    detail: local,
  });

  const privateIp = validateProductUrl("http://192.168.1.5/item", {
    allowedPlatforms: ["trendyol"],
    allowShortTrendyolLinks: false,
  });
  checks.push({
    label: "private ip rejected",
    passed: privateIp.ok === false && privateIp.code === "URL_INVALID",
    detail: privateIp,
  });

  const nonProduct = validateProductUrl("https://www.trendyol.com/sr?q=kulaklik", {
    allowedPlatforms: ["trendyol"],
    allowShortTrendyolLinks: false,
  });
  checks.push({
    label: "non-product trendyol path rejected",
    passed: nonProduct.ok === false && nonProduct.code === "URL_INVALID",
    detail: nonProduct,
  });

  const unsupported = validateProductUrl("https://www.example.com/product/42", {
    allowedPlatforms: ["trendyol"],
    allowShortTrendyolLinks: false,
  });
  checks.push({
    label: "unsupported platform rejected",
    passed: unsupported.ok === false && unsupported.code === "PLATFORM_NOT_SUPPORTED",
    detail: unsupported,
  });

  const empty = validateProductUrl("   ", {
    allowedPlatforms: ["trendyol"],
    allowShortTrendyolLinks: false,
  });
  checks.push({
    label: "empty url rejected with URL_REQUIRED",
    passed: empty.ok === false && empty.code === "URL_REQUIRED",
    detail: empty,
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
