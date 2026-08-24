import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getReleaseLayout({ productName, version, packageName }) {
  const releaseDir = path.posix.join("release", `${productName} ${version}`);
  const appFileName = `${productName} ${version}.exe`;
  const setupFileName = `${productName} ${version} Setup.exe`;

  return {
    releaseDir,
    appSource: path.posix.join("src-tauri", "target", "release", `${packageName}.exe`),
    setupSource: path.posix.join(
      "src-tauri",
      "target",
      "release",
      "bundle",
      "nsis",
      `${productName}_${version}_x64-setup.exe`
    ),
    setupSignatureSource: path.posix.join(
      "src-tauri",
      "target",
      "release",
      "bundle",
      "nsis",
      `${productName}_${version}_x64-setup.exe.sig`
    ),
    appDestination: path.posix.join(releaseDir, appFileName),
    setupDestination: path.posix.join(releaseDir, setupFileName),
    setupSignatureDestination: path.posix.join(releaseDir, `${setupFileName}.sig`),
    checksumDestination: path.posix.join(releaseDir, "SHA256SUMS.txt"),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toNativePath(filePath) {
  return filePath.split("/").join(path.sep);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function packageRelease() {
  const packageJson = readJson("package.json");
  const tauriConfig = readJson("src-tauri/tauri.conf.json");
  const layout = getReleaseLayout({
    productName: tauriConfig.productName,
    version: tauriConfig.version,
    packageName: packageJson.name,
  });

  const releaseDir = toNativePath(layout.releaseDir);
  fs.rmSync(releaseDir, { recursive: true, force: true });
  fs.mkdirSync(releaseDir, { recursive: true });

  const artifacts = [
    {
      source: toNativePath(layout.appSource),
      destination: toNativePath(layout.appDestination),
      fileName: path.basename(layout.appDestination),
    },
    {
      source: toNativePath(layout.setupSource),
      destination: toNativePath(layout.setupDestination),
      fileName: path.basename(layout.setupDestination),
    },
    {
      source: toNativePath(layout.setupSignatureSource),
      destination: toNativePath(layout.setupSignatureDestination),
      fileName: path.basename(layout.setupSignatureDestination),
    },
  ];

  for (const artifact of artifacts) {
    if (!fs.existsSync(artifact.source)) {
      throw new Error(`Missing build artifact: ${artifact.source}`);
    }

    fs.copyFileSync(artifact.source, artifact.destination);
  }

  const checksums = artifacts
    .map((artifact) => `${sha256(artifact.destination)}  ${artifact.fileName}`)
    .join("\n");
  fs.writeFileSync(toNativePath(layout.checksumDestination), `${checksums}\n`);

  return layout;
}

export function isDirectExecution(moduleUrl, scriptPath) {
  const normalizeExecutionPath = (filePath) => {
    let normalized = filePath.replaceAll("\\", "/");

    if (/^\/[A-Za-z]:\//.test(normalized)) {
      normalized = normalized.slice(1);
    }

    if (/^[A-Za-z]:\//.test(normalized)) {
      return normalized.toLowerCase();
    }

    return path.resolve(normalized).replaceAll("\\", "/");
  };

  return (
    normalizeExecutionPath(fileURLToPath(moduleUrl)) === normalizeExecutionPath(scriptPath)
  );
}

if (process.argv[1] && isDirectExecution(import.meta.url, process.argv[1])) {
  try {
    const layout = packageRelease();
    console.log(`Packaged release: ${layout.releaseDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
