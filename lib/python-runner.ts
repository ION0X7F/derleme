import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function buildPythonCandidates() {
  const home = process.env.USERPROFILE;
  const possibleAbsoluteCandidates = [
    process.env.SELLBOOST_PYTHON_PATH,
    home ? `${home}\\AppData\\Local\\Programs\\Python\\Python312\\python.exe` : null,
    home
      ? `${home}\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\venv\\scripts\\nt\\python.exe`
      : null,
  ];

  const absoluteCandidates = possibleAbsoluteCandidates.filter(
    (value): value is string => typeof value === "string" && value.length > 0 && existsSync(value)
  );

  if (absoluteCandidates.length > 0) {
    return absoluteCandidates;
  }

  return [
    "python",
    "py",
  ].filter((value): value is string => Boolean(value));
}

const PYTHON_CANDIDATES = buildPythonCandidates();

export class PythonRunnerError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = "PythonRunnerError";
    this.details = details;
  }
}

async function tryExec(
  executable: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(executable, args, {
    cwd,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
}

export async function runPythonJson(params: {
  script: string;
  args?: string[];
  cwd: string;
}) {
  let lastError: unknown = null;
  const attempts: string[] = [];

  for (const executable of PYTHON_CANDIDATES) {
    try {
      const { stdout, stderr } = await tryExec(
        executable,
        ["-c", params.script, ...(params.args ?? [])],
        params.cwd
      );

      const trimmed = stdout.trim();
      if (!trimmed) {
        throw new PythonRunnerError("Python bos cikti dondurdu", stderr);
      }

      try {
        return JSON.parse(trimmed);
      } catch (error) {
        throw new PythonRunnerError(
          `Python JSON parse edilemedi (${executable})`,
          `${String(error)}\n${trimmed}\n${stderr}`
        );
      }
    } catch (error) {
      lastError = error;
      attempts.push(
        `${executable}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new PythonRunnerError(
    "Python komutu calistirilamadi",
    attempts.length > 0
      ? attempts.join("\n")
      : lastError instanceof Error
        ? lastError.message
        : String(lastError)
  );
}
