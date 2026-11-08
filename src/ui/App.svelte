<script lang="ts">
  import { openSession, SessionError, type Session } from '../loader/client';
  import type { LoadErrorCode } from '../loader/open';
  import ChatView from './ChatView.svelte';
  import Welcome from './Welcome.svelte';

  // A chat can hold hundreds of thousands of messages; it is never edited, so it stays unproxied.
  let session = $state.raw<Session | null>(null);
  let busy = $state(false);
  let error = $state<LoadErrorCode | null>(null);

  async function open(files: File[]) {
    if (busy) return;
    busy = true;
    error = null;
    try {
      session = await openSession(files);
    } catch (err) {
      error = err instanceof SessionError ? err.code : 'unknown';
      if (!(err instanceof SessionError) || err.code === 'unknown') console.error(err);
    } finally {
      busy = false;
    }
  }

  function close() {
    session?.close();
    session = null;
  }
</script>

{#if session}
  <ChatView {session} onclose={close} />
{:else}
  <Welcome {busy} {error} onopen={open} />
{/if}
