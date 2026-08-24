import fs from "node:fs";

const nextVersion = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(nextVersion ?? "")) {
  console.error("Usage: node scripts/sync-version.mjs <major.minor.patch>");
  process.exit(1);
}

function writeJsonVersion(path) {
  const content = JSON.parse(fs.readFileSync(path, "utf8"));
  content.version = nextVersion;
  fs.writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`);
}

function writePackageLockVersion(path) {
  const content = JSON.parse(fs.readFileSync(path, "utf8"));
  const rootPackage = content.packages?.[""];

  if (!rootPackage) {
    console.error(`Could not find root package metadata in ${path}`);
    process.exit(1);
  }

  content.version = nextVersion;
  rootPackage.version = nextVersion;
  fs.writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`);
}

function writeCargoVersion(path) {
  const content = fs.readFileSync(path, "utf8");
  const versionPattern = /^version = "\d+\.\d+\.\d+"/m;

  if (!versionPattern.test(content)) {
    console.error(`Could not find package version in ${path}`);
    process.exit(1);
  }

  const nextContent = content.replace(
    versionPattern,
    `version = "${nextVersion}"`
  );

  fs.writeFileSync(path, nextContent);
}

function writeCargoLockVersion(path, packageName) {
  const content = fs.readFileSync(path, "utf8");
  let packageMatches = 0;
  const sections = content.split(/(?=^\[\[package\]\]\r?$)/m).map((section) => {
    const name = section.match(/^name = "([^"]+)"\r?$/m)?.[1];
    if (name !== packageName) {
      return section;
    }

    packageMatches += 1;
    if (!/^version = "\d+\.\d+\.\d+"\r?$/m.test(section)) {
      console.error(`Could not find package version for ${packageName} in ${path}`);
      process.exit(1);
    }

    return section.replace(
      /^version = "\d+\.\d+\.\d+"/m,
      `version = "${nextVersion}"`
    );
  });

  if (packageMatches !== 1) {
    console.error(`Expected one ${packageName} package entry in ${path}, found ${packageMatches}`);
    process.exit(1);
  }

  fs.writeFileSync(path, sections.join(""));
}

writeJsonVersion("package.json");
writePackageLockVersion("package-lock.json");
writeJsonVersion("src-tauri/tauri.conf.json");
writeCargoVersion("src-tauri/Cargo.toml");
writeCargoLockVersion("src-tauri/Cargo.lock", "redmine-tickets-desktop-app");
