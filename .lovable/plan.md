## Wire your App Store ID into the update prompt

Swap the placeholder in `src/lib/appVersionCheck.ts`:

```ts
// before
export const APP_STORE_URL = "https://apps.apple.com/app/familial/id0000000000";

// after
export const APP_STORE_URL = "https://apps.apple.com/app/familial/id6760382623";
```

That's the only change. After this, when a user taps **Update Now** in the update prompt, iOS will deep-link straight to your Familial App Store listing.

No other files touched, no DB or edge function changes.
