import { describe, expect, it } from "vitest";
import { getReleaseType, incrementVersion } from "./release-version.mjs";

describe("release version calculation", () => {
  it("does not release for non-semantic commits", () => {
    expect(getReleaseType(["docs: update readme", "chore: tidy config"])).toBeNull();
    expect(incrementVersion("0.1.0", null)).toBe("0.1.0");
  });

  it("uses the highest conventional commit level once per release", () => {
    expect(getReleaseType(["fix: patch bug", "fix(auth): patch scoped bug"])).toBe(
      "patch"
    );
    expect(incrementVersion("0.1.0", "patch")).toBe("0.1.1");

    expect(getReleaseType(["feat: add sound", "fix: patch sound"])).toBe("minor");
    expect(getReleaseType(["feat(notifications): add sound", "fix: patch sound"])).toBe(
      "minor"
    );
    expect(incrementVersion("0.1.0", "minor")).toBe("0.2.0");

    expect(getReleaseType(["feat!: replace API", "fix: patch bug"])).toBe("major");
    expect(getReleaseType(["fix: patch bug\n\nBREAKING CHANGE: changed API"])).toBe(
      "major"
    );
    expect(incrementVersion("0.1.0", "major")).toBe("1.0.0");
  });
});
