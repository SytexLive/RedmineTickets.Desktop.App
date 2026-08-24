import fs from "node:fs";

export function getReleaseType(commitMessages) {
  let releaseType = commitMessages.length > 0 ? "patch" : null;

  for (const message of commitMessages) {
    if (isBreakingChange(message)) {
      return "major";
    }

    if (isFeature(message)) {
      releaseType = "minor";
      continue;
    }

    if (isFix(message) && releaseType !== "minor") {
      releaseType = "patch";
    }
  }

  return releaseType;
}

export function incrementVersion(version, releaseType) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid base version: ${version}`);
  }

  const [, major, minor, patch] = match.map(Number);

  if (releaseType === "major") {
    return `${major + 1}.0.0`;
  }

  if (releaseType === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  if (releaseType === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }

  return version;
}

function isBreakingChange(message) {
  return (
    /^[a-z][a-z0-9-]*(\([^)]+\))?!:/m.test(message) ||
    /^BREAKING[ -]CHANGE:/m.test(message)
  );
}

function isFeature(message) {
  return /^feat(\([^)]+\))?:/m.test(message);
}

function isFix(message) {
  return /^fix(\([^)]+\))?:/m.test(message);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const baseVersion = process.argv[2];
  const input = fs.readFileSync(0, "utf8");
  const commitMessages = input
    .split("\x1e")
    .map((message) => message.trim())
    .filter(Boolean);

  try {
    const releaseType = getReleaseType(commitMessages);
    const version = incrementVersion(baseVersion, releaseType);
    const changed = releaseType !== null;

    console.log(`changed=${changed}`);
    console.log(`release_type=${releaseType ?? "none"}`);
    console.log(`version=${version}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
