import {
  extractSafeCallbackPathFromUrl,
  resolveAuthRedirectUrl,
  sanitizeAuthCallbackPath,
} from "../lib/auth-callback";

type Case = {
  label: string;
  expected: string;
  actual: string;
};

const baseUrl = "https://sellboost.test";

const sanitizeCases: Case[] = [
  {
    label: "sanitize: null defaults to dashboard",
    expected: "/dashboard",
    actual: sanitizeAuthCallbackPath(null),
  },
  {
    label: "sanitize: undefined defaults to dashboard",
    expected: "/dashboard",
    actual: sanitizeAuthCallbackPath(undefined),
  },
  {
    label: "sanitize: report detail with hash allowed",
    expected: "/report/abc#x",
    actual: sanitizeAuthCallbackPath("/report/abc#x"),
  },
  {
    label: "sanitize: admin nested path allowed",
    expected: "/admin/users",
    actual: sanitizeAuthCallbackPath("/admin/users"),
  },
  {
    label: "sanitize: protocol-relative blocked",
    expected: "/dashboard",
    actual: sanitizeAuthCallbackPath("//evil.com"),
  },
  {
    label: "sanitize: external absolute blocked",
    expected: "/dashboard",
    actual: sanitizeAuthCallbackPath("https://evil.com/dashboard"),
  },
  {
    label: "sanitize: non-workspace path blocked",
    expected: "/dashboard",
    actual: sanitizeAuthCallbackPath("/pricing"),
  },
];

const resolveCases: Case[] = [
  {
    label: "resolve: internal relative accepted",
    expected: `${baseUrl}/reports?tab=all`,
    actual: resolveAuthRedirectUrl("/reports?tab=all", baseUrl),
  },
  {
    label: "resolve: same-origin absolute accepted",
    expected: `${baseUrl}/admin/system`,
    actual: resolveAuthRedirectUrl(`${baseUrl}/admin/system`, baseUrl),
  },
  {
    label: "resolve: same-origin but disallowed path fallback",
    expected: `${baseUrl}/dashboard`,
    actual: resolveAuthRedirectUrl(`${baseUrl}/pricing`, baseUrl),
  },
  {
    label: "resolve: external origin blocked",
    expected: `${baseUrl}/dashboard`,
    actual: resolveAuthRedirectUrl("https://evil.com/admin", baseUrl),
  },
];

const extractCases: Case[] = [
  {
    label: "extract: empty to dashboard",
    expected: "/dashboard",
    actual: extractSafeCallbackPathFromUrl(""),
  },
  {
    label: "extract: relative path accepted",
    expected: "/dashboard?from=login",
    actual: extractSafeCallbackPathFromUrl("/dashboard?from=login"),
  },
  {
    label: "extract: absolute same path accepted by sanitize",
    expected: "/reports/123?x=1",
    actual: extractSafeCallbackPathFromUrl("https://sellboost.ai/reports/123?x=1"),
  },
  {
    label: "extract: javascript pseudo-url blocked",
    expected: "/dashboard",
    actual: extractSafeCallbackPathFromUrl("javascript:alert(1)"),
  },
];

function run() {
  const allCases = [...sanitizeCases, ...resolveCases, ...extractCases];
  const results = allCases.map((test) => ({
    ...test,
    passed: test.expected === test.actual,
  }));
  const failed = results.filter((row) => !row.passed);

  console.log(
    JSON.stringify(
      {
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        results,
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
