import type { IncomingMessage, Server, ServerResponse } from 'node:http';

export const DEFAULT_PORT: number;
export const HOST: string;
export function resolvePath(root: string, rawUrl: string): string | null;
export function createApp(root: string): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export function openBrowser(url: string): void;
export function serve(options: { root: string; port?: number; host?: string }): Promise<{
  url: string;
  server: Server | null;
  alreadyRunning: boolean;
}>;
