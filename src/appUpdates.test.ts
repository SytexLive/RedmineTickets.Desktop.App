import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAndInstallUpdate } from "./appUpdates";

const checkMock = vi.hoisted(() => vi.fn());
const relaunchMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: checkMock
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: relaunchMock
}));

describe("checkAndInstallUpdate", () => {
  beforeEach(() => {
    checkMock.mockReset();
    relaunchMock.mockReset();
  });

  it("reports the app as current when no update is available", async () => {
    checkMock.mockResolvedValue(null);

    await expect(checkAndInstallUpdate()).resolves.toEqual({ status: "current" });
    expect(relaunchMock).not.toHaveBeenCalled();
  });

  it("downloads, installs, and relaunches when an update is available", async () => {
    const downloadAndInstall = vi.fn(() => Promise.resolve());
    checkMock.mockResolvedValue({
      version: "0.3.8",
      downloadAndInstall
    });
    relaunchMock.mockResolvedValue(undefined);

    await expect(checkAndInstallUpdate()).resolves.toEqual({
      status: "installed",
      version: "0.3.8"
    });
    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(relaunchMock).toHaveBeenCalledOnce();
  });
});
