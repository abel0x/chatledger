<script lang="ts" module>
  import type { IconName } from './Icon.svelte';

  export interface Shortcut {
    label: string;
    icon: IconName;
    run: () => void;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n/index.svelte';
  import { appearance, type TextSize, type Theme } from './appearance.svelte';
  import Icon from './Icon.svelte';
  import LangSwitch from './LangSwitch.svelte';

  interface Props {
    anchor: HTMLElement;
    /** Actions that do not fit the header on narrow screens. */
    extra: Shortcut[];
    onkeys: () => void;
    onclose: () => void;
  }

  let { anchor, extra, onkeys, onclose }: Props = $props();
  let box = $state<HTMLDivElement>();

  const themes: [Theme, string][] = $derived([
    ['system', t('settings.themeSystem')],
    ['light', t('settings.themeLight')],
    ['dark', t('settings.themeDark')],
  ]);
  const sizes: [TextSize, string][] = $derived([
    ['small', t('settings.sizeSmall')],
    ['normal', t('settings.sizeNormal')],
    ['large', t('settings.sizeLarge')],
  ]);

  function outside(e: PointerEvent) {
    if (!box?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onclose();
  }

  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
      anchor.focus();
    }
  }

  onMount(() => {
    anchor.setAttribute('aria-expanded', 'true');
    box?.querySelector<HTMLElement>('input, button, select')?.focus();
    return () => anchor.setAttribute('aria-expanded', 'false');
  });
</script>

<svelte:window onpointerdown={outside} />

<div class="popover" role="dialog" aria-label={t('settings.label')} tabindex="-1" bind:this={box} onkeydown={keydown}>
  {#if extra.length}
    <div class="extra">
      {#each extra as item (item.label)}
        <button
          type="button"
          onclick={() => {
            onclose();
            item.run();
          }}
        >
          <Icon name={item.icon} size={18} />
          {item.label}
        </button>
      {/each}
    </div>
  {/if}

  <fieldset>
    <legend>{t('settings.theme')}</legend>
    {#each themes as [value, label] (value)}
      <label><input type="radio" name="theme" {value} checked={appearance.theme === value} onchange={() => (appearance.theme = value)} /> {label}</label>
    {/each}
  </fieldset>

  <fieldset>
    <legend>{t('settings.size')}</legend>
    {#each sizes as [value, label] (value)}
      <label><input type="radio" name="size" {value} checked={appearance.size === value} onchange={() => (appearance.size = value)} /> {label}</label>
    {/each}
  </fieldset>

  <div class="row">
    <span>{t('lang.label')}</span>
    <LangSwitch />
  </div>

  <button
    class="keys"
    type="button"
    onclick={() => {
      onclose();
      onkeys();
    }}
  >
    <Icon name="keyboard" size={18} />
    {t('settings.keys')}
  </button>
</div>

<style>
  .popover {
    position: absolute;
    top: calc(100% + 4px);
    inset-inline-end: 8px;
    z-index: 30;
    display: grid;
    gap: 12px;
    width: min(300px, calc(100vw - 16px));
    padding: 12px 16px 14px;
    border-radius: 12px;
    background: var(--panel);
    box-shadow: 0 4px 16px #0b141a40;
  }

  .extra {
    display: grid;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--panel-border);
  }

  .extra button,
  .keys {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 4px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    text-align: start;
    cursor: pointer;
  }

  .extra button:hover,
  .keys:hover {
    background: color-mix(in srgb, var(--text) 8%, transparent);
  }

  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    width: 100%;
    margin-bottom: 4px;
    padding: 0;
    color: var(--muted);
    font-size: 0.82rem;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  input {
    accent-color: var(--accent);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--muted);
    font-size: 0.82rem;
  }
</style>
