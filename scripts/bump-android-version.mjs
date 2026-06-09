#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const explicitVersion = args.find((arg) => /^\d+\.\d+\.\d+$/.test(arg));
const shouldSync = args.includes("--sync");

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, "package.json")) &&
      (fs.existsSync(path.join(dir, "capacitor.config.ts")) || fs.existsSync(path.join(dir, "capacitor.config.json")))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not find the project root. Run this from the Familial project folder or android/ folder.");
}

function nextPatchVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`package.json version must be major.minor.patch, got: ${version}`);
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function versionCodeFor(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return major * 10000 + minor * 100 + patch;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function replaceOrAppendVersion(gradlePath, versionName, versionCode) {
  if (!fs.existsSync(gradlePath)) return false;

  let gradle = fs.readFileSync(gradlePath, "utf8");
  const original = gradle;

  gradle = gradle
    .replace(/versionCode\s+\d+/g, `versionCode ${versionCode}`)
    .replace(/versionName\s+["'][^"']+["']/g, `versionName "${versionName}"`)
    .replace(/versionCode\s*=\s*\d+/g, `versionCode = ${versionCode}`)
    .replace(/versionName\s*=\s*["'][^"']+["']/g, `versionName = "${versionName}"`);

  if (!/versionCode\s*(=\s*)?\d+/.test(gradle) || !/versionName\s*(=\s*)?["'][^"']+["']/.test(gradle)) {
    throw new Error(`Could not find versionCode/versionName in ${gradlePath}. Open Android Studio > app > build.gradle and set versionCode ${versionCode}, versionName "${versionName}" manually.`);
  }

  if (gradle !== original) {
    fs.writeFileSync(gradlePath, gradle);
  }

  return true;
}

const root = findProjectRoot(process.cwd());
const packagePath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const oldVersion = pkg.version;
const newVersion = explicitVersion ?? nextPatchVersion(oldVersion);
const newVersionCode = versionCodeFor(newVersion);

pkg.version = newVersion;
writeJson(packagePath, pkg);

if (fs.existsSync(packageLockPath)) {
  const lock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
  lock.version = newVersion;
  if (lock.packages?.[""]) {
    lock.packages[""].version = newVersion;
  }
  writeJson(packageLockPath, lock);
}

const gradleFiles = [
  path.join(root, "android/app/build.gradle"),
  path.join(root, "android/app/build.gradle.kts"),
];
const updatedGradle = gradleFiles.some((file) => replaceOrAppendVersion(file, newVersion, newVersionCode));

console.log(`✅ Bumped ${oldVersion} → ${newVersion}`);
console.log(`✅ Android versionCode will be ${newVersionCode}`);

if (!updatedGradle) {
  console.log("ℹ️  android/app/build.gradle not found here. Run `npx cap sync android` after pulling on your Mac, then run this script again if needed.");
}

if (shouldSync) {
  console.log("\nNext, run these from the project root:");
  console.log("  npm run build");
  console.log("  npx cap sync android");
  console.log("  bash scripts/android-post-sync.sh");
}