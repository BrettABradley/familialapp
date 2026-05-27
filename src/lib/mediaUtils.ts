export function getMediaType(url: string): 'image' | 'video' | 'audio' {
  // Voice notes from the recorder are always saved under a `voice-note-*`
  // filename. Detect them by name so legacy files that were stored with a
  // `.mp4` extension still render in an <audio> player instead of a black
  // <video>. This is a pure-display heuristic.
  if (/voice-note[-_]/i.test(url)) return 'audio';

  // Strip query string (signed URLs include `?token=<JWT>` and JWTs contain
  // dots, which would otherwise be picked up as a "file extension").
  const clean = url.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  if (!ext) return 'image';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['heic', 'heif'].includes(ext)) return 'image';
  return 'image';
}

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

export function validateFileSize(file: File): string | null {
  const type = file.type.split('/')[0];
  if (type === 'video' && file.size > MAX_VIDEO_SIZE) {
    return 'Video files must be under 100MB.';
  }
  if (type === 'audio' && file.size > MAX_AUDIO_SIZE) {
    return 'Audio files must be under 10MB.';
  }
  if (type === 'image' && file.size > MAX_IMAGE_SIZE) {
    return 'Image files must be under 20MB.';
  }
  return null;
}

export function getFileMediaType(file: File): 'image' | 'video' | 'audio' {
  const type = file.type.split('/')[0];
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  return 'image';
}
