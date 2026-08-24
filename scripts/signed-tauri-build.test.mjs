import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  buildSigningEnvironment,
  getTauriCliBin
} from "./signed-tauri-build.mjs";

describe("signed Tauri build wrapper", () => {
  it("uses an explicit signing key when one is already configured", () => {
    const env = buildSigningEnvironment({
      env: {
        TAURI_SIGNING_PRIVATE_KEY: "secret-from-ci",
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "password"
      },
      localKeyExists: () => true
    });

    expect(env.TAURI_SIGNING_PRIVATE_KEY).toBe("secret-from-ci");
    expect(env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD).toBe("password");
  });

  it("falls back to the local key path when no signing key is configured", () => {
    const env = buildSigningEnvironment({
      env: {},
      localKeyExists: () => true
    });

    expect(env.TAURI_SIGNING_PRIVATE_KEY).toBe(
      "C:\\Users\\Dominik\\.tauri\\redmine-tickets.key"
    );
    expect(env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD).toBe("");
  });

  it("uses the platform-specific local tauri CLI binary", () => {
    expect(getTauriCliBin("win32")).toBe(
      path.resolve("node_modules", ".bin", "tauri.cmd")
    );
    expect(getTauriCliBin("linux")).toBe(path.resolve("node_modules", ".bin", "tauri"));
  });
});
