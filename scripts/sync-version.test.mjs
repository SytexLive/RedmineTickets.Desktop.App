import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const createdDirectories = [];

afterEach(() => {
  for (const directory of createdDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createFixture() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sync-version-"));
  createdDirectories.push(fixtureRoot);

  fs.mkdirSync(path.join(fixtureRoot, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "src-tauri"), { recursive: true });

  fs.copyFileSync(
    path.resolve("scripts", "sync-version.mjs"),
    path.join(fixtureRoot, "scripts", "sync-version.mjs")
  );
  fs.copyFileSync(path.resolve("package.json"), path.join(fixtureRoot, "package.json"));
  fs.copyFileSync(
    path.resolve("src-tauri", "Cargo.toml"),
    path.join(fixtureRoot, "src-tauri", "Cargo.toml")
  );
  fs.copyFileSync(
    path.resolve("src-tauri", "tauri.conf.json"),
    path.join(fixtureRoot, "src-tauri", "tauri.conf.json")
  );

  return fixtureRoot;
}

describe("sync-version CLI", () => {
  it("synchronizes package, Cargo, and Tauri versions", () => {
    const fixtureRoot = createFixture();

    const result = spawnSync("node", ["scripts/sync-version.mjs", "1.2.3"], {
      cwd: fixtureRoot,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(fixtureRoot, "package.json"), "utf8")).version).toBe(
      "1.2.3"
    );
    expect(
      fs.readFileSync(path.join(fixtureRoot, "src-tauri", "Cargo.toml"), "utf8")
    ).toContain('version = "1.2.3"');
    expect(
      JSON.parse(fs.readFileSync(path.join(fixtureRoot, "src-tauri", "tauri.conf.json"), "utf8"))
        .version
    ).toBe("1.2.3");
  });

  it("fails with usage output for an invalid version", () => {
    const fixtureRoot = createFixture();

    const result = spawnSync("node", ["scripts/sync-version.mjs", "1.2"], {
      cwd: fixtureRoot,
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Usage: node scripts/sync-version.mjs <major.minor.patch>"
    );
  });
});
