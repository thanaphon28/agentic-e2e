import pc from "picocolors";
import { runScanCommand } from "./scan.js";
import { runGenerateCommand } from "./generate.js";
import { runReportCommand } from "./report.js";
import { runHealCommand } from "./heal.js";

type CheckOptions = {
    force: boolean;
    heal: boolean;
};

export async function runCheckCommand(options: CheckOptions) {
    console.log("");
    console.log(pc.cyan("Agentic E2E check started."));
    console.log("");

    console.log(pc.cyan("Step 1/4: Scanning routes"));
    await runScanCommand();

    console.log(pc.cyan("Step 2/4: Generating tests"));
    await runGenerateCommand({
        force: options.force,
        silentSkip: true,
    });

    console.log(pc.cyan("Step 3/4: Running tests and generating report"));
    const summary = await runReportCommand({
        exitOnFail: false,
    });

    if (options.heal) {
        console.log(pc.cyan("Step 4/4: Analyzing healing suggestions"));
        await runHealCommand();
    } else {
        console.log(pc.yellow("Step 4/4: Heal skipped"));
    }

    console.log("");
    console.log(pc.cyan("Agentic E2E check completed."));
    console.log("");

    if (summary.status === "failed") {
        console.log(pc.red("Result: FAILED"));
        console.log(pc.yellow("See .agentic-e2e/reports/latest.md"));
        console.log(pc.yellow("See .agentic-e2e/heal/latest.md"));
        process.exit(1);
    }

    console.log(pc.green("Result: PASSED"));
}