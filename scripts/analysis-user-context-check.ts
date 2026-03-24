import { buildUserAnalysisContextFromPlan } from "../lib/analysis-user-context";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function run() {
  const checks: Check[] = [];

  const free = buildUserAnalysisContextFromPlan({
    userId: "u1",
    plan: {
      planCode: "FREE",
      isUnlimited: false,
      monthlyAnalysisLimit: null,
    },
  });
  checks.push({
    label: "FREE maps to free access plan and default monthly limit",
    passed: free.accessPlan === "free" && free.monthlyLimit === 10 && free.access.plan === "free",
    detail: free,
  });

  const pro = buildUserAnalysisContextFromPlan({
    userId: "u2",
    plan: {
      planCode: "PREMIUM",
      isUnlimited: false,
      monthlyAnalysisLimit: 100,
    },
  });
  checks.push({
    label: "PREMIUM maps to pro access plan and keeps monthly limit",
    passed: pro.accessPlan === "pro" && pro.monthlyLimit === 100 && pro.access.plan === "pro",
    detail: pro,
  });

  const enterprise = buildUserAnalysisContextFromPlan({
    userId: "u3",
    plan: {
      planCode: "FREE",
      isUnlimited: true,
      monthlyAnalysisLimit: null,
    },
  });
  checks.push({
    label: "Unlimited always maps to enterprise access plan",
    passed:
      enterprise.accessPlan === "enterprise" &&
      enterprise.unlimited === true &&
      enterprise.access.plan === "enterprise",
    detail: enterprise,
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
