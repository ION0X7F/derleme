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
  const webhook = read("app/api/stripe/webhook/route.ts");
  const checks: Check[] = [
    {
      label: "webhook handles subscription created",
      passed: webhook.includes('event.type === "customer.subscription.created"'),
    },
    {
      label: "webhook handles subscription updated",
      passed: webhook.includes('event.type === "customer.subscription.updated"'),
    },
    {
      label: "webhook handles async payment failure",
      passed: webhook.includes('event.type === "checkout.session.async_payment_failed"'),
    },
    {
      label: "webhook handles invoice payment failure",
      passed: webhook.includes('event.type === "invoice.payment_failed"'),
    },
    {
      label: "subscription events use shared sync helper",
      passed:
        webhook.includes("async function syncMembershipFromSubscription") &&
        webhook.includes("await syncMembershipFromSubscription(event.data.object)"),
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
