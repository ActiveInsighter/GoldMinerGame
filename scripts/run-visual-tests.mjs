import { spawn } from "node:child_process";

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      env: process.env,
    });
    child.once("error", (error) => {
      console.error(error);
      resolve(1);
    });
    child.once("exit", (code, signal) => {
      if (signal) console.error(`Visual test process ended with signal ${signal}.`);
      resolve(code ?? 1);
    });
  });
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const status = await run(npx, ["playwright", "test"]);

try {
  await import("./montage-visuals.mjs");
} catch (error) {
  console.error("Unable to assemble visual contact sheets:", error);
}

process.exitCode = status;
