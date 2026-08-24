import { describe, expect, it } from "vitest";
import { getNextReleaseVersion, getVersionCommitRange } from "./prepare-release.mjs";
import { getReleaseType, incrementVersion } from "./release-version.mjs";

describe("release version calculation", () => {
  it("uses patch releases for non-semantic commits", () => {
    expect(getReleaseType(["docs: update readme", "chore: tidy config"])).toBe("patch");
    expect(incrementVersion("0.1.0", "patch")).toBe("0.1.1");
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

describe("release preparation", () => {
  it("calculates the next release version from conventional commits", () => {
    expect(
      getNextReleaseVersion({
        baseVersion: "0.2.0",
        commitMessages: ["feat: add ticket tabs", "fix: remove flicker"],
      })
    ).toEqual({
      changed: true,
      releaseType: "minor",
      version: "0.3.0",
    });
  });

  it("uses patch releases when no conventional release commit is present", () => {
    expect(
      getNextReleaseVersion({
        baseVersion: "0.2.0",
        commitMessages: ["Update ticket view"],
      })
    ).toEqual({
      changed: true,
      releaseType: "patch",
      version: "0.2.1",
    });
  });

  it("uses the last committed version file as the release boundary", () => {
    expect(getVersionCommitRange("abc123")).toBe("abc123..HEAD");
    expect(getVersionCommitRange("")).toBe("HEAD");
  });
});
