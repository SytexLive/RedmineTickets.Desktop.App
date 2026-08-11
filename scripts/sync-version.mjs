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

function writeCargoVersion(path) {
  const content = fs.readFileSync(path, "utf8");
  const nextContent = content.replace(
    /^version = "\d+\.\d+\.\d+"/m,
    `version = "${nextVersion}"`
  );

  if (nextContent === content) {
    console.error(`Could not find package version in ${path}`);
    process.exit(1);
  }

  fs.writeFileSync(path, nextContent);
}

writeJsonVersion("package.json");
writeJsonVersion("src-tauri/tauri.conf.json");
writeCargoVersion("src-tauri/Cargo.toml");
