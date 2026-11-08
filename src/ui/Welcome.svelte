<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import type { LoadErrorCode } from '../loader/open';
  import { filesFromDrop } from './drop';
  import Icon from './Icon.svelte';
  import LangSwitch from './LangSwitch.svelte';

  let {
    busy,
    error,
    onopen,
  }: { busy: boolean; error: LoadErrorCode | null; onopen: (files: File[]) => void } = $props();

  let dragging = $state(false);
  let depth = 0;

  function picked(e: Event & { currentTarget: HTMLInputElement }) {
    const files = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = '';
    if (files.length) onopen(files);
  }

  function enter(e: DragEvent) {
    e.preventDefault();
    depth++;
    dragging = true;
  }

  function leave() {
    depth = Math.max(0, depth - 1);
    if (!depth) dragging = false;
  }

  async function drop(e: DragEvent) {
    e.preventDefault();
    depth = 0;
    dragging = false;
    if (busy || !e.dataTransfer) return;
    onopen(await filesFromDrop(e.dataTransfer));
  }
</script>

<main
  class="welcome"
  class:dragging
  ondragenter={enter}
  ondragover={e => e.preventDefault()}
  ondragleave={leave}
  ondrop={drop}
>
  <div class="top"><LangSwitch /></div>

  <section class="card" aria-busy={busy}>
    <h1>{t('welcome.title')}</h1>
    <p class="lead"><Icon name="lock" size={16} /> {t('welcome.lead')}</p>

    <div class="drop">
      {#if busy}
        <div class="spinner" aria-hidden="true"></div>
        <p role="status">{t('welcome.loading')}</p>
      {:else}
        <Icon name="upload" size={36} />
        <p>{t('welcome.drop')}</p>
        <p class="or">{t('welcome.or')}</p>
        <div class="actions">
          <label class="button">
            <Icon name="file" size={18} />
            {t('welcome.pickFile')}
            <input class="visually-hidden" type="file" accept=".zip,.txt,application/zip,text/plain" multiple onchange={picked} />
          </label>
          <label class="button secondary">
            <Icon name="folder" size={18} />
            {t('welcome.pickFolder')}
            <input class="visually-hidden" type="file" webkitdirectory onchange={picked} />
          </label>
        </div>
      {/if}
    </div>

    {#if error}
      <p class="error" role="alert">{t(`error.${error}`)}</p>
    {/if}

    <details>
      <summary>{t('welcome.howTo')}</summary>
      <ul>
        <li>{t('welcome.howToAndroid')}</li>
        <li>{t('welcome.howToIos')}</li>
        <li>{t('welcome.howToSend')}</li>
      </ul>
    </details>
  </section>
</main>

<style>
  .welcome {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
  }

  .top {
    align-self: flex-end;
  }

  .card {
    width: min(560px, 100%);
    margin: auto 0;
    padding: 32px 28px;
    border-radius: 16px;
    background: var(--panel);
    box-shadow: var(--shadow);
    text-align: center;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .lead {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 24px;
    color: var(--muted);
  }

  .drop {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 28px 16px;
    border: 2px dashed var(--panel-border);
    border-radius: 12px;
    color: var(--muted);
  }

  .dragging .drop {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .drop p {
    margin: 0;
    color: var(--text);
  }

  .drop .or {
    color: var(--muted);
    font-size: 0.9em;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 6px;
  }

  .actions label:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .error {
    margin: 16px 0 0;
    color: var(--danger);
  }

  details {
    margin-top: 20px;
    text-align: start;
    color: var(--muted);
  }

  summary {
    cursor: pointer;
    text-align: center;
  }

  ul {
    padding-inline-start: 20px;
  }

  li + li {
    margin-top: 6px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--panel-border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 3s;
    }
  }
</style>
