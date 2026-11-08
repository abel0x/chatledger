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

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  '3gp': 'video/3gpp',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  opus: 'audio/ogg',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  amr: 'audio/amr',
  flac: 'audio/flac',
  pdf: 'application/pdf',
  vcf: 'text/vcard',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** Last part of a path, whichever separator the system that made it used. */
export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

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

export function mimeTypeFor(name: string): string {
  return MIME[extensionOf(name)] ?? 'application/octet-stream';
}

/**
 * The key a file is looked up by. Archives made on a Mac store names
 * decomposed, Windows does not care about case, and folders come and go,
 * so only the normalised base name is compared.
 */
export function fileKey(name: string): string {
  return baseName(name).normalize('NFC').toLowerCase();
}

/** Finds files by the name a message gives them. */
export class FileIndex<T> {
  private exact = new Map<string, T>();
  private loose = new Map<string, T>();

  add(name: string, value: T): void {
    const exact = baseName(name).normalize('NFC');
    if (!this.exact.has(exact)) this.exact.set(exact, value);
    const loose = fileKey(name);
    if (!this.loose.has(loose)) this.loose.set(loose, value);
  }

  get(name: string): T | undefined {
    return this.exact.get(baseName(name).normalize('NFC')) ?? this.loose.get(fileKey(name));
  }

  get size(): number {
    return this.exact.size;
  }
}
