import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_SIGNING_KEY = "C:\\Users\\Dominik\\.tauri\\redmine-tickets.key";

export function buildSigningEnvironment({
  env = process.env,
  localKeyExists = fs.existsSync
} = {}) {
  const nextEnv = { ...env };

  if (!nextEnv.TAURI_SIGNING_PRIVATE_KEY && localKeyExists(LOCAL_SIGNING_KEY)) {
    nextEnv.TAURI_SIGNING_PRIVATE_KEY = LOCAL_SIGNING_KEY;
    nextEnv.TAURI_SIGNING_PRIVATE_KEY_PASSWORD =
      nextEnv.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "";
  }

  return nextEnv;
}

export function getTauriCliBin(platform = process.platform) {
  const executable = platform === "win32" ? "tauri.cmd" : "tauri";
  return path.resolve("node_modules", ".bin", executable);
}

export function runSignedTauriBuild() {
  execFileSync(getTauriCliBin(), ["build", "--bundles", "nsis"], {
    env: buildSigningEnvironment(),
    shell: process.platform === "win32",
    stdio: "inherit"
  });
}

function isDirectExecution(moduleUrl, scriptPath) {
  return fileURLToPath(moduleUrl) === path.resolve(scriptPath);
}

if (process.argv[1] && isDirectExecution(import.meta.url, process.argv[1])) {
  runSignedTauriBuild();
}
