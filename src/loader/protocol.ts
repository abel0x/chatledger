import type { Chat } from '../core';
import type { SavedChat } from './library';
import type { LoadErrorCode } from './open';

export type WorkerRequest =
  | { type: 'open'; files: File[]; save: boolean }
  | { type: 'openSaved'; id: string }
  | { type: 'read'; id: number; file: string };

export type WorkerResponse =
  | { type: 'opened'; chat: Chat; found: string[]; missing: string[]; savedId: string | null }
  | { type: 'failed'; code: LoadErrorCode; detail?: string }
  | { type: 'saved'; saved: SavedChat }
  | { type: 'saveFailed'; detail?: string }
  | { type: 'read'; id: number; blob: Blob | null };
