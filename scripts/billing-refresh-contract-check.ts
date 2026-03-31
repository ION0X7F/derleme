import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
};

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function run() {
  const successPage = read("app/billing/success/page.tsx");
  const refreshRoute = read("app/api/auth/refresh-plan/route.ts");

  const checks: Check[] = [
    {
      label: "billing success polls refresh-plan route",
      passed:
        successPage.includes('fetch("/api/auth/refresh-plan"') &&
        successPage.includes("for (let attempt = 0; attempt < 6; attempt += 1)"),
    },
    {
      label: "billing success waits for premium session state",
      passed:
        successPage.includes('plan === "PREMIUM"') &&
        successPage.includes('setState("success")'),
    },
    {
      label: "refresh-plan route resolves plan from subscription source of truth",
      passed:
        refreshRoute.includes("resolvePlanForUser") &&
        refreshRoute.includes("unstable_update"),
    },
    {
      label: "refresh-plan route writes plan into session user payload",
      passed:
        refreshRoute.includes("user: {") &&
        refreshRoute.includes("plan,"),
    },
  ];

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
