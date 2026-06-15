import { spawn } from "node:child_process";
import pc from "picocolors";
import { loadConfig } from "../config/load-config.js";

type RunOptions = {
  headed: boolean;
  debug: boolean;
  ui: boolean;
};

export async function runTestCommand(options: RunOptions) {
  const config = await loadConfig(process.cwd());

  const args = ["playwright", "test"];

  if (options.headed) {
    args.push("--headed");
  }

  if (options.debug) {
    args.push("--debug");
  }

  if (options.ui) {
    args.push("--ui");
  }

  console.log("");
  console.log(pc.cyan(`Running: npx ${args.join(" ")}`));
  console.log("");

  await runCommand("npx", args, {
    E2E_BASE_URL: config.baseUrl,
  });
}

function runCommand(
  command: string,
  args: string[],
  extraEnv: Record<string, string> = {}
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}