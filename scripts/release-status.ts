import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function run(command: string) {
  try {
    return execSync(command, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readReleaseTag() {
  return run("git describe --tags --abbrev=0") ?? "none";
}

function readBranch() {
  return run("git branch --show-current") ?? "unknown";
}

function readWorktreeState() {
  const status = run("git status --short");
  return status ? "dirty" : "clean";
}

function readHead() {
  return run("git rev-parse --short HEAD") ?? "unknown";
}

function readRemoteSync() {
  const counts = run("git rev-list --left-right --count origin/main...HEAD");
  if (!counts) {
    return {
      ahead: null,
      behind: null,
    };
  }

  const [behind, ahead] = counts.split(/\s+/).map((value) => Number(value));

  return {
    ahead: Number.isFinite(ahead) ? ahead : null,
    behind: Number.isFinite(behind) ? behind : null,
  };
}

function readLatestStatusDoc() {
  const filePath = path.join(process.cwd(), "STATUS_2026-04-01.md");
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8").trim();
}

const result = {
  timestamp: new Date().toISOString(),
  branch: readBranch(),
  head: readHead(),
  releaseTag: readReleaseTag(),
  worktree: readWorktreeState(),
  remote: {
    name: "origin/main",
    ...readRemoteSync(),
  },
  references: {
    statusDoc: existsSync(path.join(process.cwd(), "STATUS_2026-04-01.md"))
      ? "STATUS_2026-04-01.md"
      : null,
    releaseNotes: existsSync(path.join(process.cwd(), "RELEASE_NOTES_2026-04-01.md"))
      ? "RELEASE_NOTES_2026-04-01.md"
      : null,
    deployChecklist: existsSync(
      path.join(process.cwd(), "DEPLOY_CHECKLIST_2026-04-01.md")
    )
      ? "DEPLOY_CHECKLIST_2026-04-01.md"
      : null,
    handoff: existsSync(path.join(process.cwd(), "HANDOFF_2026-04-01.md"))
      ? "HANDOFF_2026-04-01.md"
      : null,
  },
  latestStatusSummary: readLatestStatusDoc(),
};

console.log(JSON.stringify(result, null, 2));
