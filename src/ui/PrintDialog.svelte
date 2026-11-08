<script lang="ts">
  import { onMount } from 'svelte';
  import type { Chat } from '../core';
  import { t } from '../i18n/index.svelte';
  import Icon from './Icon.svelte';
  import { PRINT_LIMIT, printSelection, type PrintRange } from './printing';

  interface Props {
    chat: Chat;
    starred: ReadonlySet<string>;
    onprint: (indices: number[], pictures: boolean) => void;
    onclose: () => void;
  }

  let { chat, starred, onprint, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement>();
  let kind = $state<PrintRange['kind']>('all');
  let from = $state('');
  let to = $state('');
  let pictures = $state(true);

  const toDay = (value: string) => (value ? Math.floor(Date.parse(`${value}T00:00:00Z`) / 86400000) : null);
  const range = $derived<PrintRange>(kind === 'dates' ? { kind, from: toDay(from), to: toDay(to) } : { kind } as PrintRange);
  const selection = $derived(printSelection(chat, range, starred));
  const firstDay = $derived(new Date((chat.messages[0]?.time ?? 0) * 1000).toISOString().slice(0, 10));
  const lastDay = $derived(new Date((chat.messages.at(-1)?.time ?? 0) * 1000).toISOString().slice(0, 10));

  onMount(() => dialog?.showModal());
</script>

<dialog bind:this={dialog} aria-labelledby="print-title" onclose={onclose}>
  <form
    method="dialog"
    onsubmit={e => {
      e.preventDefault();
      if (!selection.indices.length) return;
      onprint(selection.indices, pictures);
      dialog?.close();
    }}
  >
    <header>
      <h2 id="print-title"><Icon name="printer" size={20} /> {t('print.title')}</h2>
    </header>

    <fieldset>
      <legend>{t('print.range')}</legend>
      <label><input type="radio" name="range" value="all" bind:group={kind} /> {t('print.all')}</label>
      <label><input type="radio" name="range" value="dates" bind:group={kind} /> {t('print.dates')}</label>
      {#if kind === 'dates'}
        <div class="dates">
          <label>{t('search.from')} <input type="date" bind:value={from} min={firstDay} max={to || lastDay} /></label>
          <label>{t('search.to')} <input type="date" bind:value={to} min={from || firstDay} max={lastDay} /></label>
        </div>
      {/if}
      <label><input type="radio" name="range" value="starred" bind:group={kind} disabled={!starred.size} /> {t('print.starred')}</label>
    </fieldset>

    <label class="check"><input type="checkbox" bind:checked={pictures} /> {t('print.pictures')}</label>

    <p class="count" role="status">
      {#if selection.total === 0}
        {t('print.none')}
      {:else}
        {t('chat.messages', { count: selection.total })}
        {#if selection.total > PRINT_LIMIT}<br />{t('print.limit', { count: PRINT_LIMIT })}{/if}
      {/if}
    </p>
    <p class="hint">{t('print.pdfHint')}</p>

    <div class="actions">
      <button class="button secondary" type="button" onclick={() => dialog?.close()}>{t('welcome.cancel')}</button>
      <button class="button" type="submit" disabled={!selection.indices.length}>{t('print.go')}</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(440px, calc(100vw - 32px));
    padding: 0;
    border: 0;
    border-radius: 14px;
    background: var(--panel);
    color: var(--text);
  }

  dialog::backdrop {
    background: #0b141a80;
  }

  form {
    display: grid;
    gap: 14px;
    padding: 16px 20px 20px;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1.05rem;
  }

  fieldset {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 6px;
    color: var(--muted);
    font-size: 0.85rem;
  }

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  input {
    accent-color: var(--accent);
  }

  .dates {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding-inline-start: 26px;
  }

  .dates label {
    display: grid;
    gap: 2px;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .dates input {
    min-height: 34px;
    padding: 4px 6px;
    border: 1px solid var(--panel-border);
    border-radius: var(--radius);
    background: var(--panel);
    color: var(--text);
  }

  .count,
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
