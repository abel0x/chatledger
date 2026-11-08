/**
 * Password protection for saved chats. A key is derived from the password
 * with PBKDF2 and never leaves memory; files are encrypted with AES-GCM in
 * chunks, each bound to its position so chunks cannot be swapped around.
 */

export interface LockRecord {
  version: 1;
  salt: string;
  iterations: number;
  /** A known text encrypted with the key, to tell a wrong password at once. */
  check: string;
}

const ITERATIONS = 600_000;
const CHUNK = 4 * 1024 * 1024;
const MAGIC = new TextEncoder().encode('CLV1');
const CHECK = 'chatledger';

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

function position(index: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, index, true);
  return out;
}

export async function deriveKey(password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function seal(key: CryptoKey, data: Uint8Array, index: number): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: position(index) as BufferSource }, key, data as BufferSource),
  );
  const out = new Uint8Array(12 + 4 + sealed.length);
  out.set(iv, 0);
  new DataView(out.buffer).setUint32(12, sealed.length, true);
  out.set(sealed, 16);
  return out;
}

async function open(key: CryptoKey, iv: Uint8Array, sealed: Uint8Array, index: number): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: position(index) as BufferSource }, key, sealed as BufferSource),
  );
}

export async function createLock(password: string, iterations = ITERATIONS): Promise<{ record: LockRecord; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, iterations);
  const check = await seal(key, new TextEncoder().encode(CHECK), 0);
  return { record: { version: 1, salt: toBase64(salt), iterations, check: toBase64(check) }, key };
}

/** The key for this record, or null when the password is wrong. */
export async function unlockWith(record: LockRecord, password: string): Promise<CryptoKey | null> {
  const key = await deriveKey(password, fromBase64(record.salt), record.iterations);
  const check = fromBase64(record.check);
  try {
    const text = await open(key, check.subarray(0, 12), check.subarray(16), 0);
    return new TextDecoder().decode(text) === CHECK ? key : null;
  } catch {
    return null;
  }
}

/** Encrypts a file chunk by chunk, so even large archives never sit in memory twice. */
export async function encryptBlob(key: CryptoKey, blob: Blob): Promise<Blob> {
  const parts: BlobPart[] = [MAGIC as BlobPart];
  for (let at = 0, index = 0; at < blob.size || index === 0; at += CHUNK, index++) {
    const chunk = new Uint8Array(await blob.slice(at, at + CHUNK).arrayBuffer());
    parts.push((await seal(key, chunk, index)) as BlobPart);
    if (at + CHUNK >= blob.size) break;
  }
  return new Blob(parts, { type: 'application/octet-stream' });
}

export async function decryptBlob(key: CryptoKey, blob: Blob, type = ''): Promise<Blob> {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (head.some((b, i) => b !== MAGIC[i])) throw new Error('not an encrypted file');
  const parts: BlobPart[] = [];
  let at = 4;
  for (let index = 0; at < blob.size; index++) {
    const header = new Uint8Array(await blob.slice(at, at + 16).arrayBuffer());
    const length = new DataView(header.buffer).getUint32(12, true);
    const sealed = new Uint8Array(await blob.slice(at + 16, at + 16 + length).arrayBuffer());
    parts.push((await open(key, header.subarray(0, 12), sealed, index)) as BlobPart);
    at += 16 + length;
  }
  return new Blob(parts, { type });
}

export async function encryptText(key: CryptoKey, text: string): Promise<Blob> {
  return encryptBlob(key, new Blob([text]));
}

export async function decryptText(key: CryptoKey, blob: Blob): Promise<string> {
  return (await decryptBlob(key, blob)).text();
}
