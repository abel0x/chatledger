<script lang="ts">
  import { onMount } from 'svelte';
  import { openSession, SessionError, type Session, type Source } from '../loader/client';
  import { libraryAvailable, listSaved, removeSaved, type SavedChat } from '../loader/library';
  import type { LoadErrorCode } from '../loader/open';
  import ChatView from './ChatView.svelte';
  import { readSetting, writeSetting } from './settings';
  import Welcome from './Welcome.svelte';

  // A chat can hold hundreds of thousands of messages; it is never edited, so it stays unproxied.
  let session = $state.raw<Session | null>(null);
  let busy = $state(false);
  let error = $state<LoadErrorCode | null>(null);
  let library = $state.raw<SavedChat[]>([]);
  let remember = $state(readSetting('remember') !== 'no');
  const canRemember = libraryAvailable();

  async function refresh() {
    library = await listSaved();
  }

  async function open(source: Source) {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const next = await openSession(source);
      session = next;
      if (next.savedId) writeSetting('last', next.savedId);
      void next.saved.then(saved => {
        if (!saved) return;
        if (session === next) writeSetting('last', saved.id);
        void refresh();
      });
    } catch (err) {
      error = err instanceof SessionError ? err.code : 'unknown';
      if (!(err instanceof SessionError) || err.code === 'unknown') console.error(err);
      if ('savedId' in source) writeSetting('last', null);
    } finally {
      busy = false;
    }
  }

  function close() {
    session?.close();
    session = null;
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
  <ChatView {session} onclose={close} />
{:else}
  <Welcome
    {busy}
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
