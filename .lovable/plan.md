

## Plan: Improve message input UX

### Changes

#### 1. Replace `Input` with `Textarea` in message composer (auto-growing, paragraph style)
In `renderMessageInput()` (line 649), swap the single-line `<Input>` for a `<Textarea>` that:
- Starts at 1 row height (~36px, matching current input)
- Auto-grows as user types (up to ~6 rows max)
- Uses `overflow-y: auto` beyond max height
- Sends on Enter (without Shift), inserts newline on Shift+Enter
- Keeps `text-[16px]` to prevent iOS zoom

#### 2. Scroll to bottom when input grows
Add `messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })` whenever `newMessage` changes length significantly (or on every change). This ensures the latest message stays visible as the textarea expands. The existing `useEffect` on `[messages, groupMessages]` only fires on new messages — we need an additional trigger tied to input height changes.

#### 3. Shrink VoiceRecorder to icon-only button
In `src/components/shared/VoiceRecorder.tsx`, change the non-recording button from:
```
<Mic className="w-4 h-4 mr-1" /> Record Voice Note
```
to just:
```
<Mic className="w-4 h-4" />
```
Make it `size="icon"` with `h-9 w-9` to match the other icon buttons in the composer row.

### Files to modify
- **`src/pages/Messages.tsx`** — Replace `<Input>` with auto-growing `<Textarea>` in `renderMessageInput()`, add scroll-on-grow effect
- **`src/components/shared/VoiceRecorder.tsx`** — Change idle button to icon-only mic button

