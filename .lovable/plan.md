

## Update Bundle ID in `capacitor.config.ts`

**What changes:**
Update the `appId` in `capacitor.config.ts` from the Lovable default (`app.lovable.f745440093af4f4390a60d52ff08c778`) to your real bundle ID: `com.familialmedia.familial`.

**After I make the change, here's what you do:**

1. **Pull the latest code** from GitHub (Settings > GitHub if not connected yet)
2. Run `npm install` then `npx cap sync ios` to sync the updated config to your Xcode project
3. In Xcode, verify the Bundle Identifier now shows `com.familialmedia.familial` under **Signing & Capabilities**
4. Connect your iPhone via USB, make sure signing works (green checkmark)
5. **Product > Archive** → **Distribute App** → **App Store Connect** → **Upload**

