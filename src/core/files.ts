import type { MediaHint } from './model';

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']);
const VIDEO = new Set(['mp4', '3gp', 'mov', 'mkv', 'webm', 'm4v']);
const AUDIO = new Set(['opus', 'ogg', 'mp3', 'm4a', 'aac', 'wav', 'amr', 'flac']);

/** Android names its files IMG-, VID-, PTT-...; iOS writes 00000012-PHOTO-2025-... */
const ANDROID_PREFIX: Record<string, MediaHint> = {
  IMG: 'image',
  VID: 'video',
  AUD: 'audio',
  PTT: 'voice',
  STK: 'sticker',
  DOC: 'document',
};
const IOS_TAG: Record<string, MediaHint> = {
  PHOTO: 'image',
  VIDEO: 'video',
  AUDIO: 'voice',
  STICKER: 'sticker',
  GIF: 'gif',
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function mediaHintFor(name: string): MediaHint {
  const ext = extensionOf(name);
  if (ext === 'vcf') return 'contact';
  const android = /^([A-Z]{3})-\d{8}-WA\d+/i.exec(name);
  const fromAndroid = android && ANDROID_PREFIX[(android[1] ?? '').toUpperCase()];
  if (fromAndroid) return fromAndroid;
  const ios = /^\d+-([A-Z]+)-\d{4}-\d{2}-\d{2}/i.exec(name);
  const fromIos = ios && IOS_TAG[(ios[1] ?? '').toUpperCase()];
  if (fromIos) return fromIos;
  if (IMAGE.has(ext)) return 'image';
  if (VIDEO.has(ext)) return 'video';
  if (AUDIO.has(ext)) return 'audio';
  return ext ? 'document' : 'unknown';
}
