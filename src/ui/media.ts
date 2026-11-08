import { mimeTypeFor, type Chat, type MediaHint } from '../core';
import { linkify } from './linkify';

export interface Visual {
  /** Message index. */
  index: number;
  file: string;
  kind: 'image' | 'video';
}

export interface Attachment {
  index: number;
  file: string;
  media: MediaHint;
}

export interface Link {
  index: number;
  href: string;
  text: string;
}

/** Photos, videos and GIFs the export contains, oldest first. Stickers stay in the chat. */
export function visuals(chat: Chat, has: (file: string) => boolean): Visual[] {
  const out: Visual[] = [];
  chat.messages.forEach((m, index) => {
    if (m.kind !== 'file' || !m.file || m.media === 'sticker' || !has(m.file)) return;
    const mime = mimeTypeFor(m.file);
    if (mime.startsWith('image/')) out.push({ index, file: m.file, kind: 'image' });
    else if (mime.startsWith('video/')) out.push({ index, file: m.file, kind: 'video' });
  });
  return out;
}

/** Documents, audio files and contact cards; voice notes and pictures are listed elsewhere. */
export function attachments(chat: Chat, has: (file: string) => boolean): Attachment[] {
  const out: Attachment[] = [];
  chat.messages.forEach((m, index) => {
    if (m.kind !== 'file' || !m.file || !has(m.file)) return;
    if (m.media === 'voice' || m.media === 'sticker') return;
    const mime = mimeTypeFor(m.file);
    if (mime.startsWith('image/') || mime.startsWith('video/')) return;
    out.push({ index, file: m.file, media: m.media ?? 'unknown' });
  });
  return out;
}

export function links(chat: Chat): Link[] {
  const out: Link[] = [];
  chat.messages.forEach((m, index) => {
    if (!m.text || m.kind === 'event') return;
    for (const part of linkify(m.text)) if (part.href) out.push({ index, href: part.href, text: part.text });
  });
  return out;
}

/** Months since year 0, for grouping by month. */
export function monthOf(time: number): number {
  const d = new Date(time * 1000);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}
