
## Fix: Keep the mobile chat header truly pinned when the iPhone keyboard opens

### Feasibility
Yes — this is feasible. The current fix was only a layout fix, but this issue is now clearly a native iPhone keyboard/viewport behavior issue, not just a spacing issue.

### What the actual issue is
When the keyboard opens on iPhone, the chat header is still moving because `position: fixed` is being recalculated against the changing mobile viewport. In this app, that effect is amplified by:
- the mobile chat being rendered as a fullscreen portal overlay
- the status bar overlay being enabled
- the header using safe-area values directly during keyboard transitions

So the header is not truly “pinned under the camera”; it is still tied to the keyboard-affected viewport.

### Do I know what the issue is?
Yes.

### Implementation approach
Instead of only styling the header differently, I would make the mobile chat use a keyboard-stable layout:

1. **Freeze keyboard resizing at the native layer**
   - Add native keyboard handling so the webview does not resize upward when the keyboard opens on iOS.
   - Configure keyboard behavior during app startup so the screen stays stable and only the composer area adjusts.

2. **Use a static top inset for chat headers**
   - Capture a stable “safe top” value for the mobile chat and use that for the DM/group header.
   - Stop relying on a top inset that can change while the keyboard animates.

3. **Keep the header in a non-moving mobile shell**
   - Refactor the DM and group chat mobile overlays so:
     - the **header is anchored to the shell**
     - the **message list scrolls underneath**
     - the **composer is the only piece that responds to keyboard height**

4. **Move only the message composer above the keyboard**
   - Track keyboard show/hide height
   - Apply that height to the bottom composer area
   - Leave the header untouched

5. **Add iOS-specific scroll locking for the open chat overlay**
   - Prevent the background/document viewport from participating in the keyboard shift while a mobile chat is open

### Files to update
- `package.json`
  - add the native keyboard package if it is not already installed
- `capacitor.config.ts`
  - configure iOS keyboard resize behavior
- `src/lib/capacitorInit.ts`
  - initialize keyboard listeners and set CSS variables/classes
- `src/index.css`
  - add CSS variables/body-lock helpers for stable mobile chat layout
- `src/pages/Messages.tsx`
  - refactor mobile DM/group chat layout so the header stays fixed below the camera and only the input/composer moves with the keyboard

### Result after this change
- Back arrow + avatar/name stay visually pinned below the Dynamic Island
- Opening the keyboard no longer pushes the chat header upward
- Only the bottom input area shifts to clear the keyboard
- DM and group chat behave the same way on iPhone
