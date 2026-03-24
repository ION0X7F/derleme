import {
  getGoogleAuthConfigState,
  getGoogleAuthConfigStateFromEnv,
} from "../lib/auth-provider-config";

function run() {
  const state = getGoogleAuthConfigState();
  const matrix = [
    {
      label: "configured:true ui:true",
      env: {
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "1",
      },
      expected: true,
    },
    {
      label: "configured:true ui:false",
      env: {
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "0",
      },
      expected: false,
    },
    {
      label: "configured:false ui:true",
      env: {
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "1",
      },
      expected: false,
    },
    {
      label: "configured:false ui:false",
      env: {
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "0",
      },
      expected: true,
    },
  ].map((entry) => {
    const evaluated = getGoogleAuthConfigStateFromEnv(entry.env);
    return {
      label: entry.label,
      expected: entry.expected,
      actual: evaluated.consistent,
      passed: evaluated.consistent === entry.expected,
      state: evaluated,
    };
  });

  const matrixFailed = matrix.filter((item) => !item.passed);
  const runtimeConsistent = state.consistent;
  const failedChecks = matrixFailed.length + (runtimeConsistent ? 0 : 1);

  const result = {
    totalChecks: 1 + matrix.length,
    passedChecks: 1 + matrix.length - failedChecks,
    failedChecks,
    state,
    matrix,
    recommendation: state.consistent
      ? "ok"
      : "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED degeri ile GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET birlikte hizalanmali",
  };

  console.log(JSON.stringify(result, null, 2));

  if (failedChecks > 0) {
    process.exit(1);
  }
}

run();
