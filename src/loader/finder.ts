/** Runs searches across the saved chats off the main thread; only the chat text is read, never the media. */

import { Everywhere } from './everywhere';
import { loadSaved } from './library';
import { openExport } from './open';
import type { FinderRequest, FinderResponse } from './protocol';

let key: CryptoKey | null = null;

const everywhere = new Everywhere(async id => {
  const opened = await openExport(await loadSaved(id, key));
  await opened.close();
  return opened.chat;
});

function send(message: FinderResponse): void {
  postMessage(message);
}

addEventListener('message', (e: MessageEvent<FinderRequest>) => {
  const { seq, query, ids } = e.data;
  // The page starts a new finder whenever the password changes, so the key here never goes stale.
  key = e.data.key;
  void everywhere
    .search(
      query,
      ids,
      hits => send({ type: 'chat', seq, hits }),
      (done, total) => send({ type: 'progress', seq, done, total }),
    )
    .then(finished => finished && send({ type: 'done', seq }));
});
