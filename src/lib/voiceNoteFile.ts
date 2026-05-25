/**
 * Convert a recorded audio Blob into a File whose extension, container type
 * and Blob `type` are all consistent.
 *
 * Strategy: SNIFF THE ACTUAL BYTES rather than trusting the Blob's `type`,
 * because:
 *   - iOS `capacitor-voice-recorder` reports `audio/aac` regardless of
 *     whether the underlying bytes are raw ADTS AAC or AAC-in-MP4 (.m4a).
 *   - Safari WKWebView MediaRecorder reports `audio/mp4` but the bytes
 *     really are MP4.
 *   - Chrome reports `audio/webm;codecs=opus`.
 *
 * Matching the file's container to its extension + Content-Type is the
 * only way to get reliable <audio> playback (duration, scrubbing, etc.)
 * across iOS Safari, desktop Chrome and Android WebView.
 */

type Detected = { ext: string; contentType: string };

function detectFromBytes(bytes: Uint8Array): Detected | null {
  if (bytes.length < 12) return null;

  // MP4 / M4A: "ftyp" at bytes 4..8
  if (
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70    // p
  ) {
    return { ext: "m4a", contentType: "audio/mp4" };
  }

  // WebM / Matroska: 0x1A 0x45 0xDF 0xA3
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return { ext: "webm", contentType: "audio/webm" };
  }

  // OggS
  if (
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    return { ext: "ogg", contentType: "audio/ogg" };
  }

  // WAV: "RIFF" .... "WAVE"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return { ext: "wav", contentType: "audio/wav" };
  }

  // MP3: "ID3" tag or MPEG frame sync 0xFFEx/0xFFFx
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0x00)
  ) {
    return { ext: "mp3", contentType: "audio/mpeg" };
  }

  // Raw AAC (ADTS): sync word 0xFFF0/0xFFF1/0xFFF8/0xFFF9
  if (bytes[0] === 0xff && (bytes[1] & 0xf0) === 0xf0) {
    return { ext: "aac", contentType: "audio/aac" };
  }

  return null;
}

function fromMime(mime: string): Detected {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return { ext: "webm", contentType: "audio/webm" };
  if (m.includes("ogg")) return { ext: "ogg", contentType: "audio/ogg" };
  if (m.includes("wav")) return { ext: "wav", contentType: "audio/wav" };
  if (m.includes("mpeg") || m.includes("mp3")) return { ext: "mp3", contentType: "audio/mpeg" };
  if (m.includes("mp4") || m.includes("m4a")) return { ext: "m4a", contentType: "audio/mp4" };
  if (m.includes("aac")) return { ext: "aac", contentType: "audio/aac" };
  // Default fallback for unknown — Safari-friendly.
  return { ext: "m4a", contentType: "audio/mp4" };
}

export async function blobToVoiceNoteFile(blob: Blob): Promise<{
  file: File;
  contentType: string;
  ext: string;
}> {
  // Sniff the first 16 bytes to determine the real container.
  let detected: Detected | null = null;
  try {
    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    detected = detectFromBytes(head);
  } catch {
    detected = null;
  }

  const { ext, contentType } = detected ?? fromMime(blob.type);

  // Re-wrap so the Blob's `type` matches the chosen container. This is what
  // makes <audio> resolve the codec on iOS Safari and report a real duration.
  const normalized = new Blob([blob], { type: contentType });
  const file = new File(
    [normalized],
    `voice-note-${Date.now()}.${ext}`,
    { type: contentType }
  );

  return { file, contentType, ext };
}
