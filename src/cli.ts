#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { runInitCommand } from "./commands/init.js";
import { runScanCommand } from "./commands/scan.js";
import { runGenerateCommand } from "./commands/generate.js";
import { runTestCommand } from "./commands/run.js";
import { runReportCommand } from "./commands/report.js";
import { runHealCommand } from "./commands/heal.js";
import { runCheckCommand } from "./commands/check.js";

const program = new Command();

program
    .name("agentic-e2e")
    .description("Personal QA Agent CLI for Next.js E2E testing")
    .version("0.1.0");

program
    .command("init")
    .description("Initialize Agentic E2E config and example test")
    .option("-f, --force", "Overwrite existing files")
    .option("--base-url <url>", "Base URL for the app", "http://localhost:3000")
    .action(async (options) => {
        try {
            await runInitCommand({
                force: Boolean(options.force),
                baseUrl: options.baseUrl,
            });
        } catch (error) {
            console.error(pc.red("Failed to initialize Agentic E2E"));

            if (error instanceof Error) {
                console.error(pc.red(error.message));
            }

            process.exit(1);
        }
    });

program
    .command("check")
    .alias("test")
    .description("Scan routes, generate tests, run report, and analyze failures")
    .option("-f, --force", "Overwrite generated test files")
    .option("--no-heal", "Skip healing analysis")
    .action(async (options) => {
        try {
            await runCheckCommand({
                force: Boolean(options.force),
                heal: options.heal !== false,
            });
        } catch (error) {
            console.error(pc.red("Agentic E2E check failed"));

            if (error instanceof Error) {
                console.error(pc.red(error.message));
            }

            process.exit(1);
        }
    });

program
    .command("scan", { hidden: true })
    .description("Scan Next.js routes and save them to .agentic-e2e/routes.json")
    .action(async () => {
        try {
            await runScanCommand();
        } catch (error) {
            console.error(pc.red("Failed to scan project"));

            if (error instanceof Error) {
                console.error(pc.red(error.message));
            }

            process.exit(1);
        }
    });

program
    .command("generate", { hidden: true })
    .description("Generate Playwright E2E tests from scanned routes")
    .option("-f, --force", "Overwrite existing generated test files")
    .action(async (options) => {
        try {
            await runGenerateCommand({
                force: Boolean(options.force),
            });
        } catch (error) {
            console.error(pc.red("Failed to generate tests"));

            if (error instanceof Error) {
                console.error(pc.red(error.message));
            }

            process.exit(1);
        }
    });

program
    .command("run", { hidden: true })
    .description("Run Playwright E2E tests")
    .option("--headed", "Run tests in headed browser mode")
    .option("--debug", "Run tests in debug mode")
    .option("--ui", "Run tests with Playwright UI mode")
    .action(async (options) => {
        try {
            await runTestCommand({
                headed: Boolean(options.headed),
                debug: Boolean(options.debug),
                ui: Boolean(options.ui),
            });
        } catch (error) {
            console.error(pc.red("Failed to run tests"));

            if (error instanceof Error) {
                console.error(pc.red(error.message));
            }

            process.exit(1);
        }
    });

program
    .command("report", { hidden: true })
    .description("Run Playwright tests and generate Agentic E2E report")
    .action(async () => {
        try {
            await runReportCommand();
        } catch (error) {
            console.error(pc.red("Failed to generate report"));

            if (error instanceof Error) {
                console.error(pc.red(error.message));
            }

            process.exit(1);
        }
    });

program
    .command("heal", { hidden: true })
    .description("Analyze latest E2E report and suggest fixes")
    .action(async () => {
        try {
            await runHealCommand();
        } catch (error) {
            console.error(pc.red("Failed to analyze healing suggestions"));

            if (error instanceof Error) {
                console.error(pc.red(error.message));
            }

            process.exit(1);
        }
    });

program.parse();