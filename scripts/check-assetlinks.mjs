#!/usr/bin/env node
// Fails loudly if public/.well-known/assetlinks.json still contains
// REPLACE_WITH_ placeholder fingerprints. Called from android-post-sync.sh
// so an unverified App Links config can never be shipped to Play.
import { readFileSync, existsSync } from "node:fs";

const PATH = "public/.well-known/assetlinks.json";

if (!existsSync(PATH)) {
  console.error(`❌ ${PATH} is missing — Android App Links will not verify.`);
  process.exit(1);
}

const raw = readFileSync(PATH, "utf8");

if (/REPLACE_WITH_/i.test(raw)) {
  console.error("");
  console.error("❌ public/.well-known/assetlinks.json still contains placeholder SHA-256 fingerprints.");
  console.error("   Without real fingerprints Android will NOT verify the App Link, and email-verify");
  console.error("   links will open Chrome instead of the app.");
  console.error("");
  console.error("   Fix: In Play Console → App integrity → App signing, copy BOTH");
  console.error("        - 'App signing key certificate' SHA-256 fingerprint");
  console.error("        - 'Upload key certificate'      SHA-256 fingerprint");
  console.error("   and paste them into the sha256_cert_fingerprints array of assetlinks.json.");
  console.error("");
  process.exit(1);
}

try {
  const parsed = JSON.parse(raw);
  const fps = parsed?.[0]?.target?.sha256_cert_fingerprints;
  if (!Array.isArray(fps) || fps.length === 0) {
    console.error("❌ assetlinks.json has no sha256_cert_fingerprints entries.");
    process.exit(1);
  }
} catch (e) {
  console.error("❌ assetlinks.json is not valid JSON:", e?.message ?? e);
  process.exit(1);
}

console.log("✅ assetlinks.json has real SHA-256 fingerprints.");
