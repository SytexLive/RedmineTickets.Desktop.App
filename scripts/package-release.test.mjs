import { describe, expect, it } from "vitest";
import { getReleaseLayout, isDirectExecution } from "./package-release.mjs";

describe("release packaging layout", () => {
  it("uses a versioned release directory with portable exe, setup exe, update signature, and checksums", () => {
    expect(
      getReleaseLayout({
        productName: "Redmine Tickets",
        version: "0.2.0",
        packageName: "redmine-tickets-desktop-app",
      })
    ).toEqual({
      releaseDir: "release/Redmine Tickets 0.2.0",
      appSource: "src-tauri/target/release/redmine-tickets-desktop-app.exe",
      setupSource:
        "src-tauri/target/release/bundle/nsis/Redmine Tickets_0.2.0_x64-setup.exe",
      setupSignatureSource:
        "src-tauri/target/release/bundle/nsis/Redmine Tickets_0.2.0_x64-setup.exe.sig",
      appDestination: "release/Redmine Tickets 0.2.0/Redmine Tickets 0.2.0.exe",
      setupDestination:
        "release/Redmine Tickets 0.2.0/Redmine Tickets 0.2.0 Setup.exe",
      setupSignatureDestination:
        "release/Redmine Tickets 0.2.0/Redmine Tickets 0.2.0 Setup.exe.sig",
      checksumDestination: "release/Redmine Tickets 0.2.0/SHA256SUMS.txt",
    });
  });

  it("detects direct execution for Windows script paths", () => {
    expect(
      isDirectExecution(
        "file:///C:/Users/Dominik/Documents/Projekte/RedmineTickets.Desktop.App/scripts/package-release.mjs",
        "C:\\Users\\Dominik\\Documents\\Projekte\\RedmineTickets.Desktop.App\\scripts\\package-release.mjs"
      )
    ).toBe(true);
  });

  it("detects direct execution for Windows script paths case-insensitively", () => {
    expect(
      isDirectExecution(
        "file:///c:/Users/Dominik/Documents/Projekte/RedmineTickets.Desktop.App/scripts/package-release.mjs",
        "C:\\Users\\Dominik\\Documents\\Projekte\\RedmineTickets.Desktop.App\\scripts\\package-release.mjs"
      )
    ).toBe(true);
  });
});
