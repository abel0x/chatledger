<script lang="ts">
  import { onMount } from 'svelte';
  import { openSession, SessionError, type Phase, type Session, type Source } from '../loader/client';
  import {
    forgetLibrary,
    libraryAvailable,
    listSaved,
    loadSaved,
    protectLibrary,
    readLock,
    removeSaved,
    unlockLibrary,
    unprotectLibrary,
    type LockRecord,
    type SavedChat,
  } from '../loader/library';
  import type { LoadErrorCode } from '../loader/open';
  import ChatView from './ChatView.svelte';
  import { readSetting, writeSetting } from './settings';
  import Welcome from './Welcome.svelte';

  // A chat can hold hundreds of thousands of messages; it is never edited, so it stays unproxied.
  let session = $state.raw<Session | null>(null);
  let busy = $state(false);
  let progress = $state<{ phase: Phase; fraction: number } | null>(null);
  let error = $state<LoadErrorCode | null>(null);
  let library = $state.raw<SavedChat[]>([]);
  let lock = $state.raw<LockRecord | null>(null);
  /** Unlocks password-protected saved chats; held in memory only, until the page closes. */
  let key = $state.raw<CryptoKey | null>(null);
  let working = $state(false);
  /** Files behind the open chat, so another export of it can be added later. */
  let openFiles: File[] | null = null;
  let openSavedId: string | null = null;
  /** Words to search for as the chat opens, after a search across all saved chats. */
  let startQuery = $state<string | null>(null);
  let remember = $state(readSetting('remember') !== 'no');
  const canRemember = libraryAvailable();

  async function refresh() {
    library = (await listSaved(key)).filter(c => !c.locked);
  }

  function reopenLast() {
    const last = readSetting('last');
    if (last && canRemember && !session) void open({ savedId: last });
  }

  async function unlock(password: string): Promise<boolean> {
    const found = await unlockLibrary(password);
    if (!found) return false;
    key = found;
    await refresh();
    reopenLast();
    return true;
  }

  async function busyWith(task: () => Promise<void>) {
    working = true;
    try {
      await task();
    } finally {
      working = false;
    }
  }

  const protect = (password: string) =>
    busyWith(async () => {
      key = await protectLibrary(password);
      lock = await readLock();
      await refresh();
    });

  const unprotect = () =>
    busyWith(async () => {
      if (key) await unprotectLibrary(key);
      lock = null;
      key = null;
      await refresh();
    });

  function lockNow() {
    key = null;
    library = [];
  }

  const forget = () =>
    busyWith(async () => {
      await forgetLibrary();
      lock = null;
      key = null;
      writeSetting('last', null);
      await refresh();
    });

  /** Opens a chat; `target` points at a message to show and words to search for, as after a search across all saved chats. */
  async function open(source: Source, target: { message: string | null; query: string } | null = null) {
    if (busy) return;
    busy = true;
    error = null;
    progress = null;
    try {
      const next = await openSession({ ...source, key }, (phase, fraction) => (progress = { phase, fraction }));
      // The chat shows the message named in the address as it opens.
      if (target?.message) history.replaceState(null, '', `#m-${target.message}`);
      startQuery = target?.query ?? null;
      session = next;
      openFiles = 'files' in source ? source.files : null;
      openSavedId = next.savedId;
      if (next.savedId) writeSetting('last', next.savedId);
      void next.saved.then(saved => {
        if (!saved) return;
        if (session === next) {
          writeSetting('last', saved.id);
          openSavedId = saved.id;
        }
        void refresh();
      });
    } catch (err) {
      error = err instanceof SessionError ? err.code : 'unknown';
      if (!(err instanceof SessionError) || err.code === 'unknown') console.error(err);
      if ('savedId' in source) writeSetting('last', null);
    } finally {
      busy = false;
      progress = null;
    }
  }

  /** Opens the chat again with one more export of it; the saved copy, if any, is replaced. */
  async function addExport(files: File[]): Promise<LoadErrorCode | null> {
    const current = session;
    if (!current) return null;
    const before = openSavedId;
    const base = openFiles ?? (before ? await loadSaved(before, key).catch(() => null) : null);
    if (!base) return 'notSaved';
    try {
      const next = await openSession({ files: [...base, ...files], save: canRemember && (remember || !!before), key });
      current.close();
      startQuery = null;
      session = next;
      openFiles = [...base, ...files];
      openSavedId = null;
      void next.saved.then(async saved => {
        if (!saved) return;
        if (session === next) {
          writeSetting('last', saved.id);
          openSavedId = saved.id;
        }
        if (before && before !== saved.id) await removeSaved(before).catch(() => {});
        void refresh();
      });
      return null;
    } catch (err) {
      return err instanceof SessionError ? err.code : 'unknown';
    }
  }

  function close() {
    session?.close();
    session = null;
    openFiles = null;
    openSavedId = null;
    writeSetting('last', null);
    void refresh();
  }

  async function remove(id: string) {
    await removeSaved(id).catch(() => {});
    if (readSetting('last') === id) writeSetting('last', null);
    await refresh();
  }

  function setRemember(value: boolean) {
    remember = value;
    writeSetting('remember', value ? null : 'no');
  }

  onMount(() => {
    void (async () => {
      lock = await readLock();
      await refresh();
      // Pick up where the reader left off after a reload; a locked library waits for its password.
      if (!lock) reopenLast();
    })();
  });
</script>

{#if session}
  {#key session}
    <ChatView {session} query={startQuery} onclose={close} onaddexport={addExport} />
  {/key}
{:else}
  <Welcome
    {busy}
    {progress}
    {error}
    {library}
    {remember}
    {canRemember}
    locked={!!lock && !key}
    protectedLibrary={!!lock && !!key}
    {working}
    onunlock={unlock}
    onprotect={protect}
    onunprotect={unprotect}
    onlocknow={lockNow}
    onforget={forget}
    onopen={files => open({ files, save: canRemember && remember })}
    onopensaved={(id, target) => open({ savedId: id }, target)}
    libraryKey={key}
    onremove={remove}
    onremember={setRemember}
  />
{/if}
