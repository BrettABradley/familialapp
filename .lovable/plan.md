
## Fix plan: keep the chat header truly below the iPhone camera/notch in the native app

### What the issue is
The current fix only adds more CSS top padding in `src/pages/Messages.tsx`:

```ts
paddingTop: 'calc(env(safe-area-inset-top) + 1rem)'
```

That helps on mobile web, but in the native iPhone app the WebView is still extending under the status bar / Dynamic Island. So the header is starting too high, and extra CSS padding alone is not reliably enough.

### Do I know what the issue is?
Yes.

### Root cause
This is now a native shell issue more than a page-spacing issue:
1. The chat screen is rendered as a full-screen `fixed inset-0` overlay via portal.
2. In the native iOS app, the status bar area is still overlaying the WebView.
3. Because of that, the chat header can still render under the camera area even though the page uses `env(safe-area-inset-top)`.

### Implementation plan

#### 1. Fix the native iOS status bar behavior
Update the Capacitor setup so the status bar does **not** overlay the WebView on iPhone.

**Files to update**
- `package.json`
- `capacitor.config.ts`

**Changes**
- Add the native status bar package if it is not already installed.
- Configure the iOS app so content starts below the status bar instead of underneath it.

This is the key fix for the native app version.

#### 2. Keep the chat header defensive in the web UI
Even after the native fix, keep the message header more robust inside `src/pages/Messages.tsx`.

**Changes**
- Replace the current inline top padding with a stronger mobile-safe approach for both:
  - DM header
  - Group header
- Use a minimum top clearance so the header never sits too close to the notch even if the safe-area value is inconsistent.
- Keep the back button and participant name in the non-scrolling header row.

#### 3. Preserve the keyboard-dismiss-on-scroll behavior
Keep the existing scroll-to-dismiss-keyboard behavior on the message list.

**File**
- `src/pages/Messages.tsx`

**Keep**
- The `onTouchMove` blur behavior on the scrollable message area
- The `flex-shrink-0` header and input bar setup

#### 4. Verify overlay layout still clears the bottom nav and safe areas
Since chats are rendered through a portal with `fixed inset-0`, I’ll verify the full-screen mobile overlay still:
- covers the bottom navigation correctly
- keeps the composer pinned at the bottom
- respects bottom safe-area spacing

### Files likely to change
- `capacitor.config.ts`
- `package.json`
- `src/pages/Messages.tsx`

### Expected result
After this change:
- the back arrow and contact name will stay fully visible below the camera / Dynamic Island in the native iPhone app
- users can always leave the chat while typing
- scrolling the chat will still dismiss the keyboard like a real messaging app

### Technical note
This needs both layers:
1. native iOS status bar / WebView positioning
2. resilient chat-header spacing in the React layout

Only changing the React padding is why the problem is still happening now.
