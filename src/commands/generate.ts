import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";
import { loadConfig } from "../config/load-config.js";

type GenerateOptions = {
  force: boolean;
  silentSkip?: boolean;
};

type RoutesJson = {
  framework: "nextjs";
  appRouter: string[];
  pagesRouter: string[];
  routes: string[];
};

export async function runGenerateCommand(options: GenerateOptions) {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);


  const routesPath = path.join(cwd, ".agentic-e2e", "routes.json");

  if (!(await fs.pathExists(routesPath))) {
    throw new Error(
      ".agentic-e2e/routes.json not found. Please run `agentic-e2e scan` first."
    );
  }

  const routesJson = (await fs.readJson(routesPath)) as RoutesJson;

  if (!routesJson.routes || routesJson.routes.length === 0) {
    throw new Error("No routes found in .agentic-e2e/routes.json.");
  }

  const outputDir = path.join(cwd, config.generatedDir);

  await fs.ensureDir(outputDir);

  const generatedFiles: string[] = [];

  for (const route of routesJson.routes) {
    const fileName = routeToFileName(route);
    const filePath = path.join(outputDir, fileName);

    if ((await fs.pathExists(filePath)) && !options.force) {
      if (!options.silentSkip) {
        console.log(pc.yellow(`Skipped existing file: ${path.relative(cwd, filePath)}`));
      }

      continue;
    }

    const content = createSpecFile(route);

    await fs.writeFile(filePath, content, "utf8");

    generatedFiles.push(path.relative(cwd, filePath));
  }

  console.log("");
  console.log(pc.green("Agentic E2E test generation completed."));
  console.log("");

  if (generatedFiles.length === 0) {
    if (options.silentSkip) {
      console.log(pc.yellow("No new tests generated. Existing generated tests were kept."));
    } else {
      console.log(pc.yellow("No files generated. Use --force to overwrite existing files."));
    }

    console.log("");
    return;
  }

  console.log(pc.cyan("Generated files:"));

  for (const file of generatedFiles) {
    console.log(`- ${file}`);
  }

  console.log("");
  console.log("Then run:");
  console.log(pc.cyan("npx playwright test"));
  console.log("");
}

function routeToFileName(route: string) {
  if (route === "/") {
    return "home.spec.ts";
  }

  const safeName = route
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .toLowerCase();

  return `${safeName}.spec.ts`;
}

function createSpecFile(route: string) {
  if (isLoginRoute(route)) {
    return createLoginSpec(route);
  }

  return createSmokeSpec(route);
}

function isLoginRoute(route: string) {
  return route.toLowerCase().includes("login") || route.toLowerCase().includes("signin");
}

function createSmokeSpec(route: string) {
  const testName = route === "/" ? "home page should load" : `${route} page should load`;

  return `import { test, expect } from "@playwright/test";

test("${escapeText(testName)}", async ({ page }) => {
  await page.goto("${route}");

  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("404");
});
`;
}

function createLoginSpec(route: string) {
  return `import { test, expect } from "@playwright/test";

test("login page should load", async ({ page }) => {
  await page.goto("${route}");

  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByRole("heading", { name: /login|sign in/i })).toBeVisible();
});

test("login form should have required fields", async ({ page }) => {
  await page.goto("${route}");

  await expect(page.locator('input[type="email"], input[name="email"], input[name="username"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: /login|sign in/i })).toBeVisible();
});
`;
}

function escapeText(value: string) {
  return value.replace(/"/g, '\\"');
}