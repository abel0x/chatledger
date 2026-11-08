import { baseName, type Chat } from '../core';
import { createLock, decryptBlob, decryptText, encryptBlob, encryptText, unlockWith, type LockRecord } from './vault';

export type { LockRecord };

/**
 * Chats the user chose to keep, stored in the browser's private file system
 * for this site. Nothing here leaves the computer; clearing the browser's
 * site data removes it.
 */

const ROOT = 'chats';
const META = 'chat.json';
/** The summary of a password-protected chat; its files are stored as 0.bin, 1.bin… so not even their names show. */
const SEALED_META = 'chat.enc';
const LOCK = 'lock.json';

export interface SavedChat {
  id: string;
  title: string | null;
  messages: number;
  people: number;
  /** Wall-clock times of the first and last message, as in `Message.time`. */
  first: number;
  last: number;
  bytes: number;
  savedAt: number;
  /** Names in the store, which may be cleaned up. */
  files: string[];
  /** The names the export used, which messages refer to. */
  names?: string[];
  /** Stored with a password that has not been given yet; only the id is known. */
  locked?: true;
  /** Stored encrypted. */
  sealed?: true;
}

export function libraryAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

async function root(): Promise<FileSystemDirectoryHandle> {
  const top = await navigator.storage.getDirectory();
  return top.getDirectoryHandle(ROOT, { create: true });
}

/** Same files, same id: picking an export twice does not store it twice. */
export function exportId(files: File[]): string {
  const key = files
    .map(f => `${baseName(f.name).normalize('NFC')}\u0000${f.size}`)
    .sort()
    .join('\u0001');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/** File names that are safe in the store and unique within one chat. */
export function storedNames(files: File[]): string[] {
  const used = new Set<string>();
  return files.map(f => {
    const clean = baseName(f.name).replace(/[\\/:*?"<>|\u0000-\u001f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '_').trim() || 'file';
    let name = clean;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const dot = clean.lastIndexOf('.');
      name = dot > 0 ? `${clean.slice(0, dot)} (${n})${clean.slice(dot)}` : `${clean} (${n})`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  if (typeof handle.createWritable === 'function') {
    const writable = await handle.createWritable();
    await data.stream().pipeTo(writable);
    return;
  }
  // Safari only writes from workers, through a synchronous handle.
  const access = await handle.createSyncAccessHandle();
  try {
    access.truncate(0);
    let at = 0;
    const reader = data.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      at += access.write(value, { at });
    }
    access.flush();
  } finally {
    access.close();
  }
}

async function readMeta(dir: FileSystemDirectoryHandle, key: CryptoKey | null = null): Promise<SavedChat | null> {
  try {
    const file = await (await dir.getFileHandle(META)).getFile();
    return JSON.parse(await file.text()) as SavedChat;
  } catch {
    // Not stored in the clear; maybe under the password.
  }
  try {
    const sealed = await (await dir.getFileHandle(SEALED_META)).getFile();
    if (!key) return { id: dir.name, title: null, messages: 0, people: 0, first: 0, last: 0, bytes: 0, savedAt: 0, files: [], locked: true };
    return { ...(JSON.parse(await decryptText(key, sealed)) as SavedChat), sealed: true };
  } catch {
    return null;
  }
}

/** Removes files a chat's summary no longer mentions, such as clear copies left behind by encrypting. */
async function tidy(dir: FileSystemDirectoryHandle, keep: Set<string>): Promise<void> {
  const names: string[] = [];
  for await (const name of dir.keys()) names.push(name);
  for (const name of names) if (!keep.has(name)) await dir.removeEntry(name).catch(() => {});
}

export async function readLock(): Promise<LockRecord | null> {
  if (!libraryAvailable()) return null;
  try {
    const file = await (await (await navigator.storage.getDirectory()).getFileHandle(LOCK)).getFile();
    return JSON.parse(await file.text()) as LockRecord;
  } catch {
    return null;
  }
}

export async function unlockLibrary(password: string): Promise<CryptoKey | null> {
  const record = await readLock();
  return record ? unlockWith(record, password) : null;
}

export async function listSaved(key: CryptoKey | null = null): Promise<SavedChat[]> {
  if (!libraryAvailable()) return [];
  const out: SavedChat[] = [];
  try {
    const dir = await root();
    for await (const entry of dir.values()) {
      if (entry.kind !== 'directory') continue;
      const meta = await readMeta(entry as FileSystemDirectoryHandle, key);
      if (meta) out.push(meta);
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export async function removeSaved(id: string): Promise<void> {
  await (await root()).removeEntry(id, { recursive: true });
}

function summary(id: string, files: File[], chat: Chat, stored: string[]): SavedChat {
  return {
    id,
    title: chat.title,
    messages: chat.messages.length,
    people: chat.people.length,
    first: chat.messages[0]?.time ?? 0,
    last: chat.messages[chat.messages.length - 1]?.time ?? 0,
    bytes: files.reduce((n, f) => n + f.size, 0),
    savedAt: Date.now(),
    files: stored,
    names: files.map(f => baseName(f.name)),
  };
}

/** Writes a chat in the clear or, given a key, encrypted; the summary goes last, so a broken copy never lists. */
async function write(dir: FileSystemDirectoryHandle, meta: SavedChat, files: Blob[], key: CryptoKey | null): Promise<SavedChat> {
  if (key) {
    const stored = files.map((_, i) => `${i}.bin`);
    for (let i = 0; i < files.length; i++) await writeFile(dir, stored[i] as string, await encryptBlob(key, files[i] as Blob));
    const sealed: SavedChat = { ...meta, files: stored };
    delete sealed.sealed;
    await writeFile(dir, SEALED_META, await encryptText(key, JSON.stringify(sealed)));
    await dir.removeEntry(META).catch(() => {});
    await tidy(dir, new Set([...stored, SEALED_META]));
    return { ...sealed, sealed: true };
  }
  for (let i = 0; i < files.length; i++) await writeFile(dir, meta.files[i] as string, files[i] as Blob);
  const plain: SavedChat = { ...meta };
  delete plain.sealed;
  await writeFile(dir, META, new Blob([JSON.stringify(plain)], { type: 'application/json' }));
  await dir.removeEntry(SEALED_META).catch(() => {});
  await tidy(dir, new Set([...plain.files, META]));
  return plain;
}

export async function saveExport(files: File[], chat: Chat, key: CryptoKey | null = null): Promise<SavedChat> {
  const id = exportId(files);
  const dir = await (await root()).getDirectoryHandle(id, { create: true });
  const existing = await readMeta(dir, key);
  if (existing && !existing.locked) return existing;
  return write(dir, summary(id, files, chat, storedNames(files)), files, key);
}

export async function loadSaved(id: string, key: CryptoKey | null = null): Promise<File[]> {
  const dir = await (await root()).getDirectoryHandle(id);
  const meta = await readMeta(dir, key);
  if (!meta || meta.locked) throw new Error('missing');
  return Promise.all(
    meta.files.map(async (stored, i) => {
      const file = await (await dir.getFileHandle(stored)).getFile();
      const original = meta.names?.[i] ?? stored;
      const data = meta.sealed && key ? await decryptBlob(key, file) : file;
      return data === file && original === stored ? file : new File([data], original, { lastModified: file.lastModified });
    }),
  );
}

async function rewriteAll(from: CryptoKey | null, to: CryptoKey | null): Promise<void> {
  const top = await root();
  for await (const entry of top.values()) {
    if (entry.kind !== 'directory') continue;
    const dir = entry as FileSystemDirectoryHandle;
    const meta = await readMeta(dir, from);
    if (!meta || meta.locked) continue;
    const files = await loadSaved(meta.id, from);
    const stored = to ? meta.files : storedNames(files);
    await write(dir, { ...meta, files: stored }, files, to);
  }
}

/** Puts a password on the library and encrypts every chat already saved. */
export async function protectLibrary(password: string): Promise<CryptoKey> {
  const { record, key } = await createLock(password);
  await rewriteAll(null, key);
  const top = await navigator.storage.getDirectory();
  await writeFile(top, LOCK, new Blob([JSON.stringify(record)], { type: 'application/json' }));
  return key;
}

/** Takes the password off again, storing every chat in the clear. */
export async function unprotectLibrary(key: CryptoKey): Promise<void> {
  await rewriteAll(key, null);
  await (await navigator.storage.getDirectory()).removeEntry(LOCK).catch(() => {});
}

/** For a forgotten password: without it nothing can be read, so everything saved goes. */
export async function forgetLibrary(): Promise<void> {
  const top = await navigator.storage.getDirectory();
  await top.removeEntry(ROOT, { recursive: true }).catch(() => {});
  await top.removeEntry(LOCK).catch(() => {});
}
