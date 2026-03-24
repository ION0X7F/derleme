import {
  attachReportVersionMeta,
  readReportVersionMeta,
} from "../lib/report-versioning";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function run() {
  const checks: Check[] = [];

  const baseAccess = {
    plan: "pro",
    lockedSections: [] as string[],
  };

  const first = attachReportVersionMeta({
    accessState: baseAccess,
    trigger: "analyze",
    generation: 0,
    previousReportId: null,
    rootReportId: null,
  });
  const firstMeta = readReportVersionMeta(first);
  checks.push({
    label: "first analyze version defaults are consistent",
    passed:
      firstMeta.trigger === "analyze" &&
      firstMeta.generation === 0 &&
      firstMeta.previousReportId === null &&
      firstMeta.rootReportId === null,
    detail: firstMeta,
  });

  const second = attachReportVersionMeta({
    accessState: baseAccess,
    trigger: "reanalyze",
    generation: 1,
    previousReportId: "rep_1",
    rootReportId: "rep_1",
  });
  const secondMeta = readReportVersionMeta(second);
  checks.push({
    label: "reanalyze version persists chain anchors",
    passed:
      secondMeta.trigger === "reanalyze" &&
      secondMeta.generation === 1 &&
      secondMeta.previousReportId === "rep_1" &&
      secondMeta.rootReportId === "rep_1",
    detail: secondMeta,
  });

  const third = attachReportVersionMeta({
    accessState: baseAccess,
    trigger: "reanalyze",
    generation: 2,
    previousReportId: "rep_2",
    rootReportId: "rep_1",
  });
  const thirdMeta = readReportVersionMeta(third);
  checks.push({
    label: "nested reanalyze keeps root and increments generation",
    passed:
      thirdMeta.trigger === "reanalyze" &&
      thirdMeta.generation === 2 &&
      thirdMeta.previousReportId === "rep_2" &&
      thirdMeta.rootReportId === "rep_1",
    detail: thirdMeta,
  });

  const brokenMeta = readReportVersionMeta({
    versioning: {
      previousReportId: "",
      rootReportId: 42,
      generation: -8,
      trigger: "something-else",
    },
  });
  checks.push({
    label: "invalid metadata is normalized safely",
    passed:
      brokenMeta.trigger === "analyze" &&
      brokenMeta.generation === 0 &&
      brokenMeta.previousReportId === null &&
      brokenMeta.rootReportId === null,
    detail: brokenMeta,
  });

  const createdAtIsString =
    typeof (first as { versioning?: { createdAt?: unknown } }).versioning?.createdAt ===
    "string";
  checks.push({
    label: "attached metadata includes createdAt timestamp",
    passed: createdAtIsString,
    detail: (first as { versioning?: { createdAt?: unknown } }).versioning?.createdAt,
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
