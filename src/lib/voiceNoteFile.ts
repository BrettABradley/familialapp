/**
 * Convert a recorded audio Blob into a File whose extension, container type
 * and Blob `type` are all consistent. This matters because:
 *
 * - The native `capacitor-voice-recorder` plugin on iOS reports a Blob with
 *   `type: "audio/aac"` even though the bytes are an .m4a (AAC-in-MP4)
 *   container. If we save it with extension `.m4a` but keep the Blob's
 *   `type` as `audio/aac`, the HTML <audio> element cannot resolve the
 *   container/codec and reports `duration = 0`, which is exactly what shows
 *   up as "0:00 / 0:00" in the preview and prevents users from posting.
 *
 * - On web/Android the recorder returns `audio/webm;codecs=opus`. We want
 *   the file to keep the `.webm` extension and `audio/webm` type so it
 *   plays back correctly everywhere.
 *
 * This helper is the single source of truth used by every voice-note caller
 * (feed, messages, fridge) so the upload contentType and the file name
 * always agree.
 */
export function blobToVoiceNoteFile(blob: Blob): {
  file: File;
  contentType: string;
  ext: string;
} {
  const rawMime = (blob.type || "").toLowerCase();

  let ext = "m4a";
  let contentType = "audio/mp4";

  if (rawMime.includes("webm")) {
    ext = "webm";
    contentType = "audio/webm";
  } else if (rawMime.includes("wav")) {
    ext = "wav";
    contentType = "audio/wav";
  } else if (rawMime.includes("ogg")) {
    ext = "ogg";
    contentType = "audio/ogg";
  } else if (rawMime === "audio/aac" || rawMime === "audio/aacp") {
    // iOS `capacitor-voice-recorder` returns RAW AAC (ADTS) bytes with this
    // mime — NOT an MP4 container. Saving as .m4a/audio/mp4 makes browsers
    // unable to decode (no moov atom → duration 0:00 and no playback).
    // Keep it as .aac/audio/aac so Safari/Chrome decode it natively.
    ext = "aac";
    contentType = "audio/aac";
  } else if (
    rawMime.includes("mp4") ||
    rawMime.includes("m4a") ||
    rawMime === ""
  ) {
    ext = "m4a";
    contentType = "audio/mp4";
  }

  // Re-wrap the Blob so its `type` matches the chosen container. This is the
  // key fix for the "0:00 / 0:00" duration bug on iOS.
  const normalized = new Blob([blob], { type: contentType });
  const file = new File(
    [normalized],
    `voice-note-${Date.now()}.${ext}`,
    { type: contentType }
  );

  return { file, contentType, ext };
}
