/**
 * Tells the local chatledger server that a page is still open, so a copy
 * started by double-clicking can stop by itself once every tab is closed.
 * Other servers, such as the one used while developing, are left alone.
 */
export function keepAlive(every = 20_000): void {
  const ping = async () => {
    try {
      const res = await fetch('./alive', { method: 'POST', cache: 'no-store' });
      if (res.headers.get('x-chatledger') === '1') setTimeout(ping, every);
    } catch {
      // The server is gone; nothing to keep alive.
    }
  };
  void ping();
}
