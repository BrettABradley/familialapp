# Apple Resubmission Fixes (Build 49 → 50)

Two issues to address. One is a code fix; the other is App Store Connect metadata you'll handle yourself. (The duplicate IAP promo image issue you'll handle separately on your side.)

---

## 1. Guideline 2.1(a) — App crashed on "Take Photo or Video → Video" (CODE FIX)

**Root cause:** When the user picks "Take Photo or Video" from the iOS file-input action sheet and chooses **Video**, iOS opens the system camera in video-recording mode. Recording video activates the microphone, and iOS will **hard-crash any app that doesn't declare `NSMicrophoneUsageDescription` in Info.plist**. We currently declare camera + photo library, but not microphone.

The in-app `VoiceRecorder` component (mic access via `getUserMedia`) has the same requirement on native iOS — so this fix covers that too.

**Fix:** Add `NSMicrophoneUsageDescription` to `scripts/ios-post-sync.sh` so it's injected into `ios/App/App/Info.plist` on every `cap sync`.

```bash
# Microphone permission (required for video recording + voice notes)
$PB -c "Delete :NSMicrophoneUsageDescription" "$PLIST" 2>/dev/null
$PB -c "Add :NSMicrophoneUsageDescription string 'Familial needs access to your microphone to record video with sound and voice notes for your family circle.'" "$PLIST"
```

Then rerun `npx cap sync ios && bash scripts/ios-post-sync.sh`, rebuild in Xcode, bump build number, and resubmit.

**Verification:** On a real device after rebuild, tap Add Media → Take Photo or Video → Video. iOS should now show the mic permission prompt instead of crashing.

---

## 2. Guideline 3.1.2(c) — EULA link missing in App Store metadata (METADATA, you do this)

The in-app disclosure is already correct (the `SubscriptionDisclosure` component renders Terms of Use (EULA) + Privacy links at every IAP point of purchase). Apple is asking for the link in the **App Store Connect metadata**, not in the app itself.

**You need to do one of these in App Store Connect:**

**Option A (easiest — use Apple's standard EULA):**
- Go to App Store Connect → Your App → App Information → **App Description**
- At the bottom of the description, add this exact line:

  ```
  Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
  Privacy Policy: https://www.familialmedia.com/privacy-policy
  ```

**Option B (use your custom EULA):**
- App Store Connect → App Information → **License Agreement** → Custom EULA → paste your Terms of Service text. Then no link is needed in the description.

I recommend **Option A** — it's faster and Apple accepts it.

Also paste this same line into **App Review Information → Notes** so the reviewer sees it without hunting.

---

## Order of operations

1. I implement the microphone Info.plist fix (one file change, ~3 lines).
2. You rebuild in Xcode (bump build to 50), upload to App Store Connect.
3. While that's processing, you:
   - Add the EULA + Privacy line to the App Description (and App Review Notes).
   - Handle the duplicate IAP promo images on your side.
4. Submit the screen-recording reply Apple asked for, demonstrating the disclosure block on the Pricing / Upgrade screens.
5. Resubmit for review.

Approve the plan and I'll make the code change.
