<script lang="ts">
  import { LIMITS, type Chat, type Message } from '../core';
  import { eventText, locale, t } from '../i18n/index.svelte';
  import { dayOf, formatClock, formatDay } from './format';
  import Icon from './Icon.svelte';
  import { searchableText, snippet } from './search';
  import { exportStars, importStars, type Stars } from './stars.svelte';

  interface Props {
    chat: Chat;
    stars: Stars;
    onpick: (messageIndex: number) => void;
    onclose: () => void;
    ontoast: (message: string) => void;
  }

  let { chat, stars, onpick, onclose, ontoast }: Props = $props();

  let fileInput = $state<HTMLInputElement>();

  const starred = $derived(
    chat.messages.flatMap((m, index) => (stars.ids.has(m.id) ? [{ m, index }] : [])),
  );

  function summary(m: Message): string {
    if (m.event) return eventText(m.event, chat.self);
    return snippet(searchableText(m), [], 90) || t(`media.${m.media ?? 'unknown'}`);
  }

  function download() {
    const blob = new Blob([exportStars(chat, stars.ids)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(chat.title ?? 'chat').replace(/[\\/:*?"<>|]/g, '_')} - starred.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function load(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const ids = file.size > LIMITS.starsFileBytes ? null : importStars(await file.text(), chat);
    if (ids == null) ontoast(t('starred.importBad'));
    else {
      const added = stars.addAll(ids);
      ontoast(added ? t('starred.imported', { count: added }) : t('starred.importNone'));
    }
  }
</script>

<aside class="panel" aria-label={t('chat.starred')}>
  <div class="head">
    <h2><Icon name="star" size={18} filled /> {t('chat.starred')}</h2>
    <button class="icon-button" type="button" onclick={onclose} aria-label={t('gallery.close')} title={t('gallery.close')}>
      <Icon name="close" />
    </button>
  </div>
  <div class="tools">
    <button class="button secondary" type="button" onclick={download} disabled={!starred.length}>
      <Icon name="download" size={16} />
      {t('starred.export')}
    </button>
    <button class="button secondary" type="button" onclick={() => fileInput?.click()}>
      <Icon name="upload" size={16} />
      {t('starred.import')}
    </button>
    <input class="visually-hidden" type="file" accept=".json,application/json" bind:this={fileInput} onchange={load} tabindex="-1" />
  </div>

  {#if !starred.length}
    <p class="empty">{t('starred.empty')}</p>
  {:else}
    <ol class="results">
      {#each starred as { m, index } (m.id)}
        <li>
          <button class="go" type="button" onclick={() => onpick(index)}>
            <span class="meta">
              {#if m.sender != null}<span class={`who c${m.sender % 12}`}>{chat.people[m.sender]}</span>{/if}
              <time>{formatDay(dayOf(m.time), locale())} {formatClock(m.time, locale())}</time>
            </span>
            <span class="text">{summary(m)}</span>
          </button>
          <button class="icon-button" type="button" onclick={() => stars.toggle(m.id)} aria-label={t('menu.unstar')} title={t('menu.unstar')}>
            <Icon name="star" size={18} filled />
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--panel);
    border-inline-start: 1px solid var(--panel-border);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 4px 16px;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .tools {
    display: flex;
    gap: 8px;
    padding: 6px 16px 12px;
    border-bottom: 1px solid var(--panel-border);
  }

  .tools .button {
    min-height: 34px;
    padding: 4px 12px;
    font-size: 0.85rem;
  }

  .empty {
    padding: 16px;
    color: var(--muted);
  }

  .results {
    flex: 1;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--panel-border);
    color: var(--muted);
  }

  .go {
    flex: 1;
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: 10px 6px 10px 16px;
    border: 0;
    background: transparent;
    text-align: start;
    cursor: pointer;
  }

  .go:hover {
    background: color-mix(in srgb, var(--text) 5%, transparent);
  }

  .meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.78rem;
  }

  .who {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta time {
    flex: none;
  }

  .text {
    color: var(--text);
    overflow-wrap: anywhere;
    font-size: 0.9rem;
  }
</style>
