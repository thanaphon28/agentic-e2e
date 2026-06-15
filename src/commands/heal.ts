import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";
import { loadConfig } from "../config/load-config.js";

type HealFinding = {
  title: string;
  file: string;
  status: string;
  kind: "locator" | "timeout" | "navigation" | "assertion" | "unknown";
  confidence: "low" | "medium" | "high";
  errorMessage: string;
  suggestion: string;
};

type HealReport = {
  status: "clean" | "needs-review";
  generatedAt: string;
  totalFindings: number;
  findings: HealFinding[];
};

export async function runHealCommand() {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  const rawReportPath = path.join(
    cwd,
    config.reportsDir,
    "latest.raw.json"
  );

  const summaryReportPath = path.join(
    cwd,
    config.reportsDir,
    "latest.json"
  );

  if (!(await fs.pathExists(rawReportPath)) && !(await fs.pathExists(summaryReportPath))) {
    throw new Error(
      "No report found. Please run `agentic-e2e report` before `agentic-e2e heal`."
    );
  }

  const findings = await analyzeLatestReport(rawReportPath, summaryReportPath);

  const healDir = path.join(cwd, config.healDir);
  const healJsonPath = path.join(healDir, "latest.json");
  const healMarkdownPath = path.join(healDir, "latest.md");

  await fs.ensureDir(healDir);

  const healReport: HealReport = {
    status: findings.length === 0 ? "clean" : "needs-review",
    generatedAt: new Date().toISOString(),
    totalFindings: findings.length,
    findings,
  };

  await fs.writeJson(healJsonPath, healReport, { spaces: 2 });
  await fs.writeFile(healMarkdownPath, createHealMarkdown(healReport), "utf8");

  console.log("");

  if (healReport.status === "clean") {
    console.log(pc.green("No failed tests found. No healing needed."));
  } else {
    console.log(pc.yellow("Agentic E2E found failed tests that need review."));
    console.log("");
    console.log(`Findings: ${healReport.totalFindings}`);
  }

  console.log("");
  console.log(pc.cyan("Saved:"));
  console.log(`- ${path.relative(cwd, healJsonPath)}`);
  console.log(`- ${path.relative(cwd, healMarkdownPath)}`);
  console.log("");
}

async function analyzeLatestReport(
  rawReportPath: string,
  summaryReportPath: string
): Promise<HealFinding[]> {
  if (await fs.pathExists(rawReportPath)) {
    const raw = await fs.readJson(rawReportPath);
    return analyzeRawPlaywrightReport(raw);
  }

  const summary = await fs.readJson(summaryReportPath);
  return analyzeSummaryReport(summary);
}

function analyzeRawPlaywrightReport(raw: any): HealFinding[] {
  const findings: HealFinding[] = [];

  collectFailuresFromSuites(raw.suites ?? [], findings);

  return findings;
}

function collectFailuresFromSuites(suites: any[], findings: HealFinding[]) {
  for (const suite of suites) {
    const suiteFile = suite.file ?? "";

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const lastResult = results[results.length - 1];

        const status = lastResult?.status ?? "unknown";

        if (status === "passed" || status === "skipped") {
          continue;
        }

        const errorMessage = extractErrorMessage(lastResult);
        const diagnosis = diagnoseFailure(errorMessage);

        findings.push({
          title: spec.title ?? test.title ?? "Unknown test",
          file: spec.file ?? suiteFile,
          status,
          kind: diagnosis.kind,
          confidence: diagnosis.confidence,
          errorMessage,
          suggestion: diagnosis.suggestion,
        });
      }
    }

    collectFailuresFromSuites(suite.suites ?? [], findings);
  }
}

function analyzeSummaryReport(summary: any): HealFinding[] {
  const findings: HealFinding[] = [];

  for (const test of summary.tests ?? []) {
    if (test.status === "passed" || test.status === "skipped") {
      continue;
    }

    const errorMessage = test.errorMessage ?? "";
    const diagnosis = diagnoseFailure(errorMessage);

    findings.push({
      title: test.title ?? "Unknown test",
      file: test.file ?? "",
      status: test.status ?? "unknown",
      kind: diagnosis.kind,
      confidence: diagnosis.confidence,
      errorMessage,
      suggestion: diagnosis.suggestion,
    });
  }

  return findings;
}

function extractErrorMessage(result: any) {
  const errors = result?.errors ?? [];

  if (errors.length > 0 && errors[0]?.message) {
    return cleanAnsi(errors[0].message);
  }

  if (result?.error?.message) {
    return cleanAnsi(result.error.message);
  }

  return "";
}

function diagnoseFailure(errorMessage: string): {
  kind: HealFinding["kind"];
  confidence: HealFinding["confidence"];
  suggestion: string;
} {
  const message = errorMessage.toLowerCase();

  if (
    message.includes("net::") ||
    message.includes("navigation") ||
    message.includes("page.goto") ||
    message.includes("err_connection") ||
    message.includes("err_failed") ||
    message.includes("connection_refused")
  ) {
    return {
      kind: "navigation",
      confidence: "high",
      suggestion:
        "This looks like a navigation issue. Check baseURL, dev server status, route existence, redirects, and whether the page returns 404/500.",
    };
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("exceeded")
  ) {
    return {
      kind: "timeout",
      confidence: "high",
      suggestion:
        "This looks like a timeout issue. Check whether the app is running, the page is slow, an API request is hanging, or the assertion waits for an element that never appears.",
    };
  }

  if (
    message.includes("locator") ||
    message.includes("strict mode violation") ||
    message.includes("to be visible") ||
    message.includes("tobevisible") ||
    message.includes("getbyrole") ||
    message.includes("getbytext") ||
    message.includes("getbylabel")
  ) {
    return {
      kind: "locator",
      confidence: "high",
      suggestion:
        "This looks like a locator/assertion visibility issue. Check whether the element text, role, label, or test id changed. Prefer getByRole/getByLabel/getByTestId over fragile CSS selectors.",
    };
  }

  if (
    message.includes("expect") ||
    message.includes("received") ||
    message.includes("expected")
  ) {
    return {
      kind: "assertion",
      confidence: "medium",
      suggestion:
        "This looks like an assertion mismatch. Check whether the expected text/value is still correct or whether the UI changed.",
    };
  }

  return {
    kind: "unknown",
    confidence: "low",
    suggestion:
      "Unable to classify the failure automatically. Open the Playwright report or run with --headed/--debug to inspect the issue.",
  };
}

function createHealMarkdown(report: HealReport) {
  const lines: string[] = [];

  lines.push("# Agentic E2E Heal Report");
  lines.push("");
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Status: ${report.status === "clean" ? "CLEAN" : "NEEDS REVIEW"}`);
  lines.push(`- Total Findings: ${report.totalFindings}`);
  lines.push("");

  if (report.findings.length === 0) {
    lines.push("## Result");
    lines.push("");
    lines.push("No failed tests found. No healing needed.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Findings");
  lines.push("");

  for (const [index, finding] of report.findings.entries()) {
    lines.push(`### ${index + 1}. ${escapeMarkdown(finding.title)}`);
    lines.push("");
    lines.push(`- File: ${finding.file}`);
    lines.push(`- Status: ${finding.status}`);
    lines.push(`- Kind: ${finding.kind}`);
    lines.push(`- Confidence: ${finding.confidence}`);
    lines.push("");
    lines.push("#### Suggestion");
    lines.push("");
    lines.push(finding.suggestion);
    lines.push("");

    if (finding.errorMessage) {
      lines.push("#### Error Message");
      lines.push("");
      lines.push("```txt");
      lines.push(finding.errorMessage.trim());
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function cleanAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, "\\|");
}