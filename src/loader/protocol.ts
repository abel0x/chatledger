import type { Chat } from '../core';
import type { DocBlock } from './docx';
import type { SavedChat } from './library';
import type { LoadErrorCode } from './open';

export type WorkerRequest =
  | { type: 'open'; files: File[]; save: boolean }
  | { type: 'openSaved'; id: string }
  | { type: 'read'; id: number; file: string }
  | { type: 'thumb'; id: number; file: string; size: number }
  | { type: 'doc'; id: number; file: string };

export type WorkerResponse =
  | { type: 'opened'; chat: Chat; found: string[]; missing: string[]; savedId: string | null }
  | { type: 'failed'; code: LoadErrorCode; detail?: string }
  | { type: 'saved'; saved: SavedChat }
  | { type: 'saveFailed'; detail?: string }
  | { type: 'read'; id: number; blob: Blob | null }
  | { type: 'thumb'; id: number; thumb: Thumbnail | null }
  | { type: 'doc'; id: number; doc: DocPreview | null };

export type DocPreview = { kind: 'docx'; blocks: DocBlock[] } | { kind: 'text'; text: string; cut: boolean };

export interface Thumbnail {
  blob: Blob;
  /** Size of the original picture. */
  width: number;
  height: number;
}
