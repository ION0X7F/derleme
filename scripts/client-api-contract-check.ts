import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
};

function run() {
  const source = readFileSync(resolve(process.cwd(), "lib/api.ts"), "utf8");
  const checks: Check[] = [
    {
      label: "fetchReports supports options.detail",
      passed: source.includes("options?: FetchReportsOptions"),
    },
    {
      label: "fetchReports defaults detail mode to compact",
      passed: source.includes('const detail = options?.detail === "full" ? "full" : "compact"'),
    },
    {
      label: "fetchReports sends detail query parameter",
      passed: source.includes("`/api/reports?detail=${detail}`"),
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
