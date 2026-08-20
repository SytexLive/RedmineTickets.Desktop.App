import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getReleaseType, incrementVersion } from "./release-version.mjs";

export function getNextReleaseVersion({ baseVersion, commitMessages }) {
  const releaseType = getReleaseType(commitMessages);
  const version = incrementVersion(baseVersion, releaseType);

  return {
    changed: releaseType !== null && version !== baseVersion,
    releaseType,
    version,
  };
}

export function getVersionCommitRange(lastVersionCommit) {
  const commit = lastVersionCommit.trim();
  return commit ? `${commit}..HEAD` : "HEAD";
}

export function parseCommitLog(commitLog) {
  return commitLog
    .split("\x1e")
    .map((message) => message.trim())
    .filter(Boolean);
}

export function prepareRelease({ cwd = process.cwd(), env = process.env } = {}) {
  const packageJsonPath = path.join(cwd, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const baseVersion = packageJson.version;
  const range = getVersionCommitRange(readLastVersionCommit(cwd));
  const commitMessages = parseCommitLog(readCommitLog(cwd, range));
  const nextRelease = getNextReleaseVersion({ baseVersion, commitMessages });

  if (!nextRelease.changed) {
    console.log(`Release version stays at ${baseVersion}.`);
    return nextRelease;
  }

  execFileSync(process.execPath, ["scripts/sync-version.mjs", nextRelease.version], {
    cwd,
    stdio: "inherit",
  });
  console.log(`Release version bumped to ${nextRelease.version}.`);

  return nextRelease;
}

function readLastVersionCommit(cwd) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%H", "--", "package.json"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function readCommitLog(cwd, range) {
  try {
    return execFileSync("git", ["log", "--format=%B%x1e", range], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    prepareRelease();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
