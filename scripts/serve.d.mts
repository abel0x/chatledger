import type { IncomingMessage, Server, ServerResponse } from 'node:http';

export const DEFAULT_PORT: number;
export const HOST: string;
export function resolvePath(root: string, rawUrl: string): string | null;
export interface ServedFile {
  name: string;
  size: number;
  body(): Buffer | NodeJS.ReadableStream;
}
export type FileSource = (rawUrl: string) => Promise<ServedFile | null>;
export function directorySource(root: string): FileSource;
export function assetSource(keys: string[], read: (key: string) => ArrayBuffer): FileSource;
export function createApp(
  source: string | FileSource,
  options?: { alive?: () => void },
): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export function openBrowser(url: string): void;
export function serve(options: {
  root?: string;
  source?: FileSource;
  port?: number;
  host?: string;
  /** Milliseconds without a page calling in before the server stops; 0 keeps it running. */
  idleExit?: number;
  onIdle?: () => void;
}): Promise<{
  url: string;
  server: Server | null;
  alreadyRunning: boolean;
}>;
