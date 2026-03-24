import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function run() {
  const content = read("app/api/reports/[id]/export/route.ts");
  const checks: Check[] = [];

  checks.push({
    label: "export route resolves mode from request query",
    passed: /function resolveExportMode\(req: Request\)/m.test(content),
  });

  checks.push({
    label: "export route supports compact mode branch",
    passed: /if \(params\.mode === "full"\) \{[\s\S]*return basePayload;[\s\S]*\}/m.test(
      content
    ),
  });

  checks.push({
    label: "export route returns response-level mode field",
    passed: /return NextResponse\.json\(\{[\s\S]*mode,[\s\S]*exportPayload/m.test(
      content
    ),
  });

  checks.push({
    label: "export success log includes selected mode",
    passed: /extra: \{ reportId: report\.id, mode \}/m.test(content),
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
