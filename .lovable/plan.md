# Android review — what I found and what to fix

I read through every Android-touching part of the app. Most of it is solid, but there are four real bugs and two smaller clean-ups.

## The real bugs

**1. A purchase can be marked "paid" when it wasn't (highest risk)**
When the app sends a purchase receipt to the server, it treats *any* reply that isn't an outright error as "credited" and then deletes the receipt from its retry list. If the server ever answers with an empty or unexpected reply, the purchase is thrown away and the member seats never arrive. Same flaw exists on the iPhone side.
Fix: only treat a purchase as credited when the server explicitly says so. Anything else stays in the retry queue. Also add a genuine "permanently failed" outcome so a receipt that can never validate stops retrying forever and the person is told to contact support instead of "it will finish automatically".

**2. Push notifications can get permanently stuck**
The notification sign-up routine is written in a way where, if one step fails unexpectedly, the routine never finishes and never errors — it just hangs. Every later attempt that session also hangs, so the phone silently stops receiving notifications until the app is restarted.
Fix: restructure so any failure ends the attempt cleanly, and start the timeout watchdog at the beginning rather than partway through.

**3. Maps links can silently do nothing on Android**
Opening an address uses a maps-only link and then returns immediately. If no maps app handles it, nothing happens at all — the intended web fallback is never reached.
Fix: after trying the maps app, fall back to the Google Maps web link if the page is still showing after a moment.

**4. App links file still has placeholders**
`public/.well-known/assetlinks.json` still contains placeholder signing values, so email links open in Chrome instead of the app, and the build script will refuse to finish the next Android sync.
Fix: I need the two SHA-256 fingerprints from Play Console (App integrity → App signing: app signing key certificate and upload key certificate). Blocked until you send them.

## Smaller clean-ups

- The Android sync script rewrites the version number without checking the edit actually applied, and prints a success tick either way. Add a check that fails loudly.
- The old-style storage permission is added without an Android-13 cutoff, which Play's automated review can flag as an unnecessary permission. Add the version cap.

## Technical notes

- `src/lib/googlePlayReceiptQueue.ts:93-107` and `src/lib/iapPurchase.ts:126-149` — replace the trailing `return "credited"` with `"retry"`, and return the existing-but-unreachable `"failed"` for explicit non-retryable server responses.
- `src/lib/pushNotifications.ts:117` — remove the async Promise executor; arm `registrationWatchdog` before the listener registrations.
- `src/lib/externalUrl.ts:104-118` — replace the unconditional `return` after the `geo:` navigation with a visibility-check fallback to the https maps URL.
- `scripts/android-post-sync.sh:96-102` — verify the perl substitutions matched (and handle `build.gradle.kts`); line 40 — add `android:maxSdkVersion="32"` to `READ_EXTERNAL_STORAGE`.
- Verify with `bunx tsgo --noEmit -p tsconfig.app.json` plus a build, then bump the Android version.

iPhone behaviour is unchanged except for the shared receipt fix, which makes it safer on both platforms.
