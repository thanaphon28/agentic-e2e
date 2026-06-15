import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";

type InitOptions = {
  force: boolean;
  baseUrl: string;
};

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export async function runInitCommand(options: InitOptions) {
  const cwd = process.cwd();

  const packageJsonPath = path.join(cwd, "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error("package.json not found. Please run this command inside a Next.js project.");
  }

  const packageJson = (await fs.readJson(packageJsonPath)) as PackageJson;

  const isNextProject = hasPackage(packageJson, "next");

  if (!isNextProject) {
    console.log(pc.yellow("Warning: This project does not look like a Next.js project."));
    console.log(pc.yellow("Agentic E2E v0.1 is designed for Next.js + Playwright first."));
  }

  const hasPlaywright = hasPackage(packageJson, "@playwright/test");

  const configPath = path.join(cwd, ".agentic-e2e.config.ts");
  const testDir = path.join(cwd, "tests", "e2e");
  const exampleTestPath = path.join(testDir, "example.spec.ts");
  const playwrightConfigPath = path.join(cwd, "playwright.config.ts");

  await fs.ensureDir(testDir);

  await writeFileSafe(
    configPath,
    createAgenticConfig(options.baseUrl),
    options.force
  );

  await writeFileSafe(
    exampleTestPath,
    createExampleTest(),
    options.force
  );

  await writeFileSafe(
    playwrightConfigPath,
    createPlaywrightConfig(),
    options.force
  );

  console.log("");
  console.log(pc.green("Agentic E2E initialized successfully."));
  console.log("");
  console.log(pc.cyan("Created:"));
  console.log(`- .agentic-e2e.config.ts`);
  console.log(`- tests/e2e/example.spec.ts`);
  console.log(`- playwright.config.ts`);
  console.log("");

  if (!hasPlaywright) {
    console.log(pc.yellow("Playwright is not installed yet."));
    console.log("");
    console.log("Run:");
    console.log(pc.cyan("npm install -D @playwright/test"));
    console.log(pc.cyan("npx playwright install"));
    console.log("");
  }

  console.log("Then run:");
  console.log(pc.cyan("npx playwright test"));
  console.log("");
}

function hasPackage(packageJson: PackageJson, packageName: string) {
  return Boolean(
    packageJson.dependencies?.[packageName] ||
    packageJson.devDependencies?.[packageName]
  );
}

async function writeFileSafe(filePath: string, content: string, force: boolean) {
  const exists = await fs.pathExists(filePath);

  if (exists && !force) {
    console.log(pc.yellow(`Skipped existing file: ${path.relative(process.cwd(), filePath)}`));
    return;
  }

  await fs.writeFile(filePath, content, "utf8");
}

function createAgenticConfig(baseUrl: string) {
  return `export default {
  framework: "nextjs",
  baseUrl: "${baseUrl}",
  testDir: "tests/e2e",
  runner: "playwright",
  agent: {
    mode: "review-before-write"
  }
};
`;
}

function createExampleTest() {
  return `import { test, expect } from "@playwright/test";

test("home page should load", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/.+/);
});
`;
}

function createPlaywrightConfig() {
  return `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
`;
}