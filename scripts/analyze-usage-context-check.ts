import {
  getAnalyzeActor,
  resolveUserAnalyzeUsageContext,
  type AnalyzeUsageTarget,
} from "../lib/analyze-usage-context";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

async function run() {
  const checks: Check[] = [];

  const userTarget: AnalyzeUsageTarget = { type: "user", userId: "u_1" };
  const guestTarget: AnalyzeUsageTarget = { type: "guest", guestId: "g_1" };

  checks.push({
    label: "user actor format is stable",
    passed: getAnalyzeActor(userTarget) === "user:u_1",
    detail: getAnalyzeActor(userTarget),
  });

  checks.push({
    label: "guest actor format is stable",
    passed: getAnalyzeActor(guestTarget) === "guest:g_1",
    detail: getAnalyzeActor(guestTarget),
  });

  const unlimited = await resolveUserAnalyzeUsageContext({
    userId: "u_2",
    monthlyLimit: 10,
    unlimited: true,
  });

  checks.push({
    label: "unlimited user returns unlimited usage window without db dependency",
    passed:
      unlimited.usageWindow.allowed === true &&
      unlimited.usageWindow.periodKey === "unlimited" &&
      unlimited.actor === "user:u_2",
    detail: unlimited,
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
