<script lang="ts">
  import { onMount } from 'svelte';
  import { openSession, SessionError, type Phase, type Session, type Source } from '../loader/client';
  import { libraryAvailable, listSaved, loadSaved, removeSaved, type SavedChat } from '../loader/library';
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
  /** Files behind the open chat, so another export of it can be added later. */
  let openFiles: File[] | null = null;
  let openSavedId: string | null = null;
  let remember = $state(readSetting('remember') !== 'no');
  const canRemember = libraryAvailable();

  async function refresh() {
    library = await listSaved();
  }

  async function open(source: Source) {
    if (busy) return;
    busy = true;
    error = null;
    progress = null;
    try {
      const next = await openSession(source, (phase, fraction) => (progress = { phase, fraction }));
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
    const base = openFiles ?? (before ? await loadSaved(before).catch(() => null) : null);
    if (!base) return 'notSaved';
    try {
      const next = await openSession({ files: [...base, ...files], save: canRemember && (remember || !!before) });
      current.close();
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
    void refresh();
    // Pick up where the reader left off after a reload.
    const last = readSetting('last');
    if (last && canRemember) void open({ savedId: last });
  });
</script>

{#if session}
  {#key session}
    <ChatView {session} onclose={close} onaddexport={addExport} />
  {/key}
{:else}
  <Welcome
    {busy}
    {progress}
    {error}
    {library}
    {remember}
    {canRemember}
    onopen={files => open({ files, save: canRemember && remember })}
    onopensaved={id => open({ savedId: id })}
    onremove={remove}
    onremember={setRemember}
  />
{/if}
