import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const cargoBin = join(homedir(), ".cargo", "bin");
const cargoNames = process.platform === "win32" ? ["cargo.exe", "cargo.cmd", "cargo.bat"] : ["cargo"];
const cli = fileURLToPath(new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url));
const pathHasCargo = (process.env.PATH ?? "").split(delimiter).some((directory) =>
  cargoNames.some((name) => existsSync(join(directory, name))),
);

if (!existsSync(join(cargoBin, cargoNames[0])) && !pathHasCargo) {
  console.error("Rust/Cargo is missing. Install it with rustup, then run npm run tauri again.");
  console.error("Linux/macOS: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh");
  process.exit(127);
}

if (!existsSync(cli)) {
  console.error("Tauri CLI is missing. Run npm ci, then run npm run tauri again.");
  process.exit(127);
}

const env = {
  ...process.env,
  PATH: [cargoBin, process.env.PATH].filter(Boolean).join(delimiter),
};
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(`Could not start Tauri CLI: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
