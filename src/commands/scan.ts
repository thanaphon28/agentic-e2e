import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";

type ScanResult = {
  framework: "nextjs";
  appRouter: string[];
  pagesRouter: string[];
  routes: string[];
};

const PAGE_FILE_REGEX = /^(page|index)\.(tsx|ts|jsx|js|mdx)$/;
const ROUTE_FILE_REGEX = /\.(tsx|ts|jsx|js|mdx)$/;

export async function runScanCommand() {
  const cwd = process.cwd();

  const packageJsonPath = path.join(cwd, "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error("package.json not found. Please run this command inside a project.");
  }

  const packageJson = await fs.readJson(packageJsonPath);

  const isNextProject = Boolean(
    packageJson.dependencies?.next || packageJson.devDependencies?.next
  );

  if (!isNextProject) {
    console.log(pc.yellow("Warning: This project does not look like a Next.js project."));
  }

  const appRouterRoutes = await scanAppRouter(cwd);
  const pagesRouterRoutes = await scanPagesRouter(cwd);

  const routes = uniqueRoutes([...appRouterRoutes, ...pagesRouterRoutes]);

  const result: ScanResult = {
    framework: "nextjs",
    appRouter: appRouterRoutes,
    pagesRouter: pagesRouterRoutes,
    routes,
  };

  const outputDir = path.join(cwd, ".agentic-e2e");
  const outputPath = path.join(outputDir, "routes.json");

  await fs.ensureDir(outputDir);
  await fs.writeJson(outputPath, result, { spaces: 2 });

  console.log("");
  console.log(pc.green("Agentic E2E scan completed."));
  console.log("");

  if (routes.length === 0) {
    console.log(pc.yellow("No routes found."));
    return;
  }

  console.log(pc.cyan("Detected routes:"));
  for (const route of routes) {
    console.log(`- ${route}`);
  }

  console.log("");
  console.log(pc.green(`Saved to .agentic-e2e/routes.json`));
  console.log("");
}

async function scanAppRouter(cwd: string) {
  const appDirs = [
    path.join(cwd, "app"),
    path.join(cwd, "src", "app"),
  ];

  const routes: string[] = [];

  for (const appDir of appDirs) {
    if (!(await fs.pathExists(appDir))) continue;

    const files = await walk(appDir);

    for (const file of files) {
      const fileName = path.basename(file);

      if (!PAGE_FILE_REGEX.test(fileName)) continue;

      const route = appFileToRoute(appDir, file);

      if (route) {
        routes.push(route);
      }
    }
  }

  return uniqueRoutes(routes);
}

async function scanPagesRouter(cwd: string) {
  const pagesDirs = [
    path.join(cwd, "pages"),
    path.join(cwd, "src", "pages"),
  ];

  const routes: string[] = [];

  for (const pagesDir of pagesDirs) {
    if (!(await fs.pathExists(pagesDir))) continue;

    const files = await walk(pagesDir);

    for (const file of files) {
      if (!ROUTE_FILE_REGEX.test(file)) continue;

      const route = pagesFileToRoute(pagesDir, file);

      if (route) {
        routes.push(route);
      }
    }
  }

  return uniqueRoutes(routes);
}

function appFileToRoute(appDir: string, file: string) {
  const relativePath = path.relative(appDir, file);
  const parts = relativePath.split(path.sep);

  // remove page.tsx
  parts.pop();

  const routeParts = parts.filter((part) => {
    if (!part) return false;

    // Next.js route group เช่น (auth) ไม่ต้องนับใน URL
    if (part.startsWith("(") && part.endsWith(")")) return false;

    // Parallel route เช่น @modal ไม่ต้องนับ
    if (part.startsWith("@")) return false;

    // Private folder เช่น _components ไม่ต้องนับ
    if (part.startsWith("_")) return false;

    return true;
  });

  const route = "/" + routeParts.join("/");

  return normalizeRoute(route);
}

function pagesFileToRoute(pagesDir: string, file: string) {
  const relativePath = path.relative(pagesDir, file);

  // ignore API routes
  if (relativePath.startsWith(`api${path.sep}`)) {
    return null;
  }

  const withoutExt = relativePath.replace(/\.(tsx|ts|jsx|js|mdx)$/, "");
  const parts = withoutExt.split(path.sep);

  // ignore _app, _document, _error
  if (parts.some((part) => part.startsWith("_"))) {
    return null;
  }

  if (parts[parts.length - 1] === "index") {
    parts.pop();
  }

  const route = "/" + parts.join("/");

  return normalizeRoute(route);
}

function normalizeRoute(route: string) {
  const cleaned = route.replace(/\/+/g, "/");

  if (cleaned === "") return "/";
  if (cleaned === "/") return "/";

  return cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
}

function uniqueRoutes(routes: string[]) {
  return Array.from(new Set(routes)).sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const childFiles = await walk(fullPath);
      files.push(...childFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}