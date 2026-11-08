import type { Chat } from '../core';
import type { LoadErrorCode } from './open';

export type WorkerRequest = { type: 'open'; files: File[] } | { type: 'read'; id: number; file: string };

export type WorkerResponse =
  | { type: 'opened'; chat: Chat; found: string[]; missing: string[] }
  | { type: 'failed'; code: LoadErrorCode; detail?: string }
  | { type: 'read'; id: number; blob: Blob | null };
