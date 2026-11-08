const PREFIX = 'chatledger.';

/** Small preferences in local storage; storage can be blocked, so every access is guarded. */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // Not remembered; nothing else depends on it.
  }
}
