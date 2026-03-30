import { spawn, type ChildProcess } from "child_process";

const npmCmd = "npm";
const useShell = process.platform === "win32";
const children = new Set<ChildProcess>();
let shuttingDown = false;

function startProcess(label: string, args: string[]) {
  const child = spawn(npmCmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: useShell,
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) return;

    const reason =
      signal != null
        ? `${label} signal ile kapandi: ${signal}`
        : `${label} cikis kodu ile kapandi: ${code ?? 0}`;

    console.error(`[dev-full] ${reason}`);
    shutdown(code ?? 0);
  });

  child.on("error", (error) => {
    if (shuttingDown) return;
    console.error(`[dev-full] ${label} baslatilamadi:`, error);
    shutdown(1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {}
  }

  setTimeout(() => {
    for (const child of children) {
      try {
        child.kill("SIGKILL");
      } catch {}
    }
    process.exit(exitCode);
  }, 1200).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[dev-full] next dev + analyze worker baslatiliyor...");
startProcess("web", ["run", "dev:web"]);
startProcess("worker", ["run", "worker:analyze"]);
