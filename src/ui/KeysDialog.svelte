<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n/index.svelte';
  import type { Key } from '../i18n/en';
  import Icon from './Icon.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let dialog = $state<HTMLDialogElement>();

  const KEYS: [string[], Key][] = [
    [['Ctrl', 'F'], 'keys.search'],
    [['/'], 'keys.search'],
    [['Enter'], 'keys.older'],
    [['Shift', 'Enter'], 'keys.newer'],
    [['D'], 'keys.date'],
    [['S'], 'keys.starred'],
    [['M'], 'keys.gallery'],
    [['I'], 'keys.info'],
    [['T'], 'keys.stats'],
    [['Home', 'End'], 'keys.ends'],
    [['←', '→'], 'keys.viewer'],
    [['Esc'], 'keys.close'],
    [['?'], 'keys.help'],
  ];

  onMount(() => {
    dialog?.showModal();
  });
</script>

<dialog bind:this={dialog} aria-labelledby="keys-title" onclose={onclose} onclick={e => e.target === dialog && dialog?.close()}>
  <div class="inner">
    <header>
      <h2 id="keys-title">{t('settings.keys')}</h2>
      <button class="icon-button" type="button" onclick={() => dialog?.close()} aria-label={t('gallery.close')}>
        <Icon name="close" />
      </button>
    </header>
    <dl>
      {#each KEYS as [keys, label], i (i)}
        <dt>{#each keys as k, j (j)}<kbd>{k}</kbd>{/each}</dt>
        <dd>{t(label)}</dd>
      {/each}
    </dl>
  </div>
</dialog>

<style>
  dialog {
    width: min(460px, calc(100vw - 32px));
    padding: 0;
    border: 0;
    border-radius: 14px;
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 8px 32px #0b141a59;
  }

  dialog::backdrop {
    background: #0b141a80;
  }

  .inner {
    padding: 12px 20px 20px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 16px;
    margin: 12px 0 0;
  }

  dt {
    display: flex;
    gap: 4px;
  }

  dd {
    margin: 0;
    align-self: center;
    color: var(--muted);
  }

  kbd {
    min-width: 26px;
    padding: 2px 7px;
    border: 1px solid var(--panel-border);
    border-bottom-width: 2px;
    border-radius: 6px;
    background: var(--bg);
    font: inherit;
    font-size: 0.85rem;
    text-align: center;
  }
</style>
