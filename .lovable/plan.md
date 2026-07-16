## Ship the Android hardening

Android purchase parity with iOS is complete and verified. Next step: publish.

### Pre-publish

- Run a security scan and confirm no unresolved critical findings before deploying.

### Publish

- Deploy the current commit to the Lovable-hosted URL. Frontend changes (all recent edits are frontend/lib) go live after the publish completes (~1 minute).
- Backend edge functions (`validate-google-receipt`, migration for `google_iap_grants`) are already deployed automatically from prior turns.

### Post-publish reminders

- Frontend WebView changes will reach the Android app on the next build only if hot-reload is on the sandbox URL (per `capacitor.config.ts`). For a real Play submission, run `bash scripts/pull-updates.sh` locally, then `npx cap sync android`, then rebuild the AAB.
- `scripts/check-assetlinks.mjs` runs during `android-post-sync.sh` and will fail loudly if the placeholder SHA-256 fingerprints haven't been replaced with real Play Console values.

### Not part of this step

- No native `android/` project changes.
- No new features or migrations.
