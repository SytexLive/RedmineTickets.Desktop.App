import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export type AppUpdateResult =
  | { status: "current" }
  | { status: "installed"; version: string };

export async function checkAndInstallUpdate(): Promise<AppUpdateResult> {
  const update = await check();

  if (!update) {
    return { status: "current" };
  }

  await update.downloadAndInstall();
  await relaunch();

  return {
    status: "installed",
    version: update.version
  };
}
