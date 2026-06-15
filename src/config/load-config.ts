import path from "node:path";
import fs from "fs-extra";
import { createJiti } from "jiti";
import type { AgenticE2EConfig, ResolvedAgenticE2EConfig } from "./types.js";

const CONFIG_FILES = [
  ".agentic-e2e.config.ts",
  ".agentic-e2e.config.js",
  ".agentic-e2e.config.mjs",
  "agentic-e2e.config.ts",
  "agentic-e2e.config.js",
  "agentic-e2e.config.mjs",
];

const DEFAULT_CONFIG: ResolvedAgenticE2EConfig = {
  framework: "nextjs",
  baseUrl: "http://localhost:3000",
  testDir: "tests/e2e",
  generatedDir: "tests/e2e/generated",
  reportsDir: ".agentic-e2e/reports",
  healDir: ".agentic-e2e/heal",
  runner: "playwright",
  agent: {
    mode: "review-before-write",
  },
  check: {
    heal: true,
  },
};

export async function loadConfig(
  cwd = process.cwd()
): Promise<ResolvedAgenticE2EConfig> {
  const configPath = await findConfigPath(cwd);

  if (!configPath) {
    return DEFAULT_CONFIG;
  }

  const jiti = createJiti(import.meta.url);

  const loaded = await jiti.import(configPath);
  const userConfig = ((loaded as any).default ?? loaded) as AgenticE2EConfig;

  return resolveConfig(userConfig);
}

export async function findConfigPath(cwd = process.cwd()) {
  for (const fileName of CONFIG_FILES) {
    const filePath = path.join(cwd, fileName);

    if (await fs.pathExists(filePath)) {
      return filePath;
    }
  }

  return null;
}

function resolveConfig(userConfig: AgenticE2EConfig): ResolvedAgenticE2EConfig {
  return {
    framework: userConfig.framework ?? DEFAULT_CONFIG.framework,
    baseUrl: userConfig.baseUrl ?? DEFAULT_CONFIG.baseUrl,
    testDir: userConfig.testDir ?? DEFAULT_CONFIG.testDir,
    generatedDir: userConfig.generatedDir ?? DEFAULT_CONFIG.generatedDir,
    reportsDir: userConfig.reportsDir ?? DEFAULT_CONFIG.reportsDir,
    healDir: userConfig.healDir ?? DEFAULT_CONFIG.healDir,
    runner: userConfig.runner ?? DEFAULT_CONFIG.runner,
    agent: {
      mode: userConfig.agent?.mode ?? DEFAULT_CONFIG.agent.mode,
    },
    check: {
      heal: userConfig.check?.heal ?? DEFAULT_CONFIG.check.heal,
    },
  };
}