export function getMediaType(url: string): 'image' | 'video' | 'audio' {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
  if (!ext) return 'image';
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['heic', 'heif'].includes(ext)) return 'image';
  // webm can be audio or video - default to video since it's more common in uploads
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
