import { buildAnalysisAccessState, resolveAccessPlan } from "../lib/analysis-access";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function hasLocked(state: ReturnType<typeof buildAnalysisAccessState>, key: string) {
  return state.lockedSections.includes(key as any);
}

function run() {
  const checks: Check[] = [];

  const guestPlan = resolveAccessPlan({
    sessionUserId: null,
    userPlan: null,
    unlimited: false,
  });
  checks.push({
    label: "guest when no session user",
    passed: guestPlan === "guest",
    detail: guestPlan,
  });

  const freePlan = resolveAccessPlan({
    sessionUserId: "u1",
    userPlan: "FREE",
    unlimited: false,
  });
  checks.push({
    label: "free for authenticated non-premium",
    passed: freePlan === "free",
    detail: freePlan,
  });

  const proPlan = resolveAccessPlan({
    sessionUserId: "u1",
    userPlan: "PREMIUM",
    unlimited: false,
  });
  checks.push({
    label: "pro for premium",
    passed: proPlan === "pro",
    detail: proPlan,
  });

  const enterprisePlan = resolveAccessPlan({
    sessionUserId: "u1",
    userPlan: "FREE",
    unlimited: true,
  });
  checks.push({
    label: "enterprise overrides by unlimited",
    passed: enterprisePlan === "enterprise",
    detail: enterprisePlan,
  });

  const guestState = buildAnalysisAccessState("guest");
  checks.push({
    label: "guest state keeps export/history/reanalysis locked",
    passed:
      hasLocked(guestState, "export") &&
      hasLocked(guestState, "history") &&
      hasLocked(guestState, "reanalysis"),
    detail: guestState.lockedSections,
  });

  const freeState = buildAnalysisAccessState("free");
  checks.push({
    label: "free unlocks history but keeps export/reanalysis locked",
    passed:
      !hasLocked(freeState, "history") &&
      hasLocked(freeState, "export") &&
      hasLocked(freeState, "reanalysis"),
    detail: freeState.lockedSections,
  });

  const proState = buildAnalysisAccessState("pro");
  checks.push({
    label: "pro unlocks all critical sections",
    passed:
      proState.lockedSections.length === 0 &&
      proState.maxSuggestions === 5 &&
      proState.maxPriorityActions === 5,
    detail: proState,
  });

  const enterpriseState = buildAnalysisAccessState("enterprise");
  checks.push({
    label: "enterprise matches full unlocked profile",
    passed:
      enterpriseState.lockedSections.length === 0 &&
      enterpriseState.maxFindings === 10 &&
      enterpriseState.maxSuggestions === 5 &&
      enterpriseState.maxPriorityActions === 5,
    detail: enterpriseState,
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
