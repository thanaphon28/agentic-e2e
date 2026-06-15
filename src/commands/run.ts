import { spawn } from "node:child_process";
import pc from "picocolors";

type RunOptions = {
  headed: boolean;
  debug: boolean;
  ui: boolean;
};

export async function runTestCommand(options: RunOptions) {
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

  await runCommand("npx", args);
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
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