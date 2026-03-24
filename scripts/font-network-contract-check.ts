import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

const TARGETS = ["app/layout.tsx", "app/globals.css"] as const;
const BLOCKED_PATTERNS = [/next\/font\/google/, /fonts\.googleapis\.com/];

function run() {
  const checks: Check[] = [];

  for (const relativePath of TARGETS) {
    const fullPath = resolve(process.cwd(), relativePath);
    const source = readFileSync(fullPath, "utf8");

    for (const pattern of BLOCKED_PATTERNS) {
      const matched = pattern.test(source);
      checks.push({
        label: `${relativePath} should not include ${pattern.source}`,
        passed: !matched,
        detail: matched ? "blocked font network pattern found" : "ok",
      });
    }
  }

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
