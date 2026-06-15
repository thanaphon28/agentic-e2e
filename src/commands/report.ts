import { spawn } from "node:child_process";
import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type TestResult = {
  title: string;
  file: string;
  status: string;
  durationMs: number;
};

type ReportSummary = {
  status: "passed" | "failed";
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  durationMs: number;
  tests: TestResult[];
};

export async function runReportCommand() {
  const cwd = process.cwd();

  const reportsDir = path.join(cwd, ".agentic-e2e", "reports");
  const rawJsonPath = path.join(reportsDir, "latest.raw.json");
  const summaryJsonPath = path.join(reportsDir, "latest.json");
  const markdownPath = path.join(reportsDir, "latest.md");
  const stderrPath = path.join(reportsDir, "latest.stderr.txt");

  await fs.ensureDir(reportsDir);

  console.log("");
  console.log(pc.cyan("Running: npx playwright test --reporter=json"));
  console.log("");

  const result = await runCommandCapture("npx", [
    "playwright",
    "test",
    "--reporter=json",
  ]);

  await fs.writeFile(rawJsonPath, result.stdout, "utf8");

  if (result.stderr.trim()) {
    await fs.writeFile(stderrPath, result.stderr, "utf8");
  }

  let playwrightJson: unknown;

  try {
    playwrightJson = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      "Failed to parse Playwright JSON report. Check .agentic-e2e/reports/latest.raw.json"
    );
  }

  const summary = createSummary(playwrightJson, result.exitCode);
  const markdown = createMarkdownReport(summary);

  await fs.writeJson(summaryJsonPath, summary, { spaces: 2 });
  await fs.writeFile(markdownPath, markdown, "utf8");

  console.log("");
  console.log(pc.green("Agentic E2E report completed."));
  console.log("");

  console.log(`Status: ${summary.status === "passed" ? pc.green("PASSED") : pc.red("FAILED")}`);
  console.log(`Total: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Flaky: ${summary.flaky}`);
  console.log(`Duration: ${formatDuration(summary.durationMs)}`);
  console.log("");

  console.log(pc.cyan("Saved:"));
  console.log("- .agentic-e2e/reports/latest.raw.json");
  console.log("- .agentic-e2e/reports/latest.json");
  console.log("- .agentic-e2e/reports/latest.md");

  if (result.stderr.trim()) {
    console.log("- .agentic-e2e/reports/latest.stderr.txt");
  }

  console.log("");

  if (summary.status === "failed") {
    process.exit(1);
  }
}

function runCommandCapture(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

function createSummary(playwrightJson: unknown, exitCode: number): ReportSummary {
  const data = playwrightJson as any;

  const tests = collectTests(data.suites ?? []);

  const passed = tests.filter((test) => test.status === "passed").length;

  const skipped = tests.filter((test) => test.status === "skipped").length;

  const failed = tests.filter((test) =>
    ["failed", "timedOut", "interrupted"].includes(test.status)
  ).length;

  const flaky = Number(data.stats?.flaky ?? 0);

  const durationMs = Number(
    data.stats?.duration ??
      tests.reduce((total, test) => total + test.durationMs, 0)
  );

  const status = exitCode === 0 && failed === 0 ? "passed" : "failed";

  return {
    status,
    generatedAt: new Date().toISOString(),
    total: tests.length,
    passed,
    failed,
    skipped,
    flaky,
    durationMs,
    tests,
  };
}

function collectTests(suites: any[]): TestResult[] {
  const results: TestResult[] = [];

  for (const suite of suites) {
    const suiteFile = suite.file ?? "";

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const lastResult = test.results?.[test.results.length - 1];

        results.push({
          title: spec.title ?? test.title ?? "Unknown test",
          file: spec.file ?? suiteFile,
          status: lastResult?.status ?? "unknown",
          durationMs: Number(lastResult?.duration ?? 0),
        });
      }
    }

    results.push(...collectTests(suite.suites ?? []));
  }

  return results;
}

function createMarkdownReport(summary: ReportSummary) {
  const failedTests = summary.tests.filter((test) =>
    ["failed", "timedOut", "interrupted"].includes(test.status)
  );

  const lines: string[] = [];

  lines.push("# Agentic E2E Report");
  lines.push("");
  lines.push(`Generated at: ${summary.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Status: ${summary.status === "passed" ? "PASSED" : "FAILED"}`);
  lines.push(`- Total: ${summary.total}`);
  lines.push(`- Passed: ${summary.passed}`);
  lines.push(`- Failed: ${summary.failed}`);
  lines.push(`- Skipped: ${summary.skipped}`);
  lines.push(`- Flaky: ${summary.flaky}`);
  lines.push(`- Duration: ${formatDuration(summary.durationMs)}`);
  lines.push("");

  if (failedTests.length > 0) {
    lines.push("## Failed Tests");
    lines.push("");

    for (const test of failedTests) {
      lines.push(`- ${escapeMarkdown(test.title)}`);
      lines.push(`  - File: ${test.file}`);
      lines.push(`  - Status: ${test.status}`);
      lines.push("");
    }
  }

  lines.push("## Test Details");
  lines.push("");
  lines.push("| Status | Test | File | Duration |");
  lines.push("|---|---|---|---|");

  for (const test of summary.tests) {
    lines.push(
      `| ${statusIcon(test.status)} ${test.status} | ${escapeMarkdown(test.title)} | ${test.file} | ${formatDuration(test.durationMs)} |`
    );
  }

  lines.push("");

  return lines.join("\n");
}

function statusIcon(status: string) {
  if (status === "passed") return "✅";
  if (status === "skipped") return "⏭️";
  if (["failed", "timedOut", "interrupted"].includes(status)) return "❌";

  return "⚠️";
}

function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, "\\|");
}