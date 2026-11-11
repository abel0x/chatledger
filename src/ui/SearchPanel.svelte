<script lang="ts">
  import { tick } from 'svelte';
  import type { Chat, Message } from '../core';
  import { locale, t } from '../i18n/index.svelte';
  import { dayOf, formatClock, formatDay } from './format';
  import Icon from './Icon.svelte';
  import { highlight, parseQuery, type KindFilter, type SearchIndex } from '../core/search';
  import { hitText } from './hits';

  interface Props {
    chat: Chat;
    index: SearchIndex;
    /** Pre-selected sender, e.g. after clicking a mention. */
    person?: number | null;
    /** Words to look for as the panel opens, e.g. from a search across all saved chats. */
    initial?: string | null;
    onpick: (messageIndex: number) => void;
    onclose: () => void;
    onterms: (terms: string[]) => void;
  }

  let { chat, index, person = null, initial = null, onpick, onclose, onterms }: Props = $props();

  const LIMIT = 300;

  let query = $state('');
  let applied = $state('');
  let sender = $state<number | null>(null);
  let kind = $state<KindFilter>('all');
  let from = $state('');
  let to = $state('');
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLOListElement>();
  /** Position in the list, which runs newest first, as Enter walks back in time. */
  let cursor = $state<number | null>(null);

  $effect.pre(() => {
    if (person != null) sender = person;
  });

  $effect.pre(() => {
    if (initial) query = applied = initial;
  });

  // Typing stays smooth on very long chats: the search runs once typing pauses.
  $effect(() => {
    const next = query;
    const timer = setTimeout(() => (applied = next), 150);
    return () => clearTimeout(timer);
  });

  const toDay = (value: string) => (value ? Math.floor(Date.parse(`${value}T00:00:00Z`) / 86400000) : null);
  const terms = $derived(parseQuery(applied));
  const result = $derived(index.search(applied, { sender, kind, from: toDay(from), to: toDay(to), limit: LIMIT }));
  const shown = $derived(result.hits.toReversed());
  const active = $derived(terms.length > 0 || sender != null || kind !== 'all' || !!from || !!to);
  const people = $derived(chat.people.map((name, i) => ({ name, i })).sort((a, b) => a.name.localeCompare(b.name)));
  const firstDay = $derived(new Date((chat.messages[0]?.time ?? 0) * 1000).toISOString().slice(0, 10));
  const lastDay = $derived(new Date((chat.messages.at(-1)?.time ?? 0) * 1000).toISOString().slice(0, 10));

  $effect(() => onterms(terms));

  $effect(() => {
    void result;
    cursor = null;
  });

  $effect(() => {
    input?.focus();
  });

  /** Enter goes to older results, Shift+Enter to newer ones, starting from the newest. */
  async function step(older: boolean) {
    const n = shown.length;
    if (!n) return;
    if (cursor == null) cursor = 0;
    else cursor = Math.max(0, Math.min(n - 1, cursor + (older ? 1 : -1)));
    const hit = shown[cursor];
    if (hit !== undefined) onpick(hit);
    await tick();
    list?.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
  }

  export function focus() {
    input?.focus();
    input?.select();
  }
</script>

<aside class="panel" aria-label={t('search.label')}>
  <div class="head">
    <label class="field">
      <Icon name="search" size={18} />
      <span class="visually-hidden">{t('search.label')}</span>
      <input
        bind:this={input}
        bind:value={query}
        type="search"
        placeholder={t('search.placeholder')}
        autocomplete="off"
        spellcheck="false"
        onkeydown={e => {
          if (e.key === 'Escape') onclose();
          else if (e.key === 'Enter') {
            e.preventDefault();
            const older = !e.shiftKey;
            // Run a search still waiting on the typing pause first, so the step lands on fresh results.
            if (applied !== query) {
              applied = query;
              void tick().then(() => step(older));
            } else void step(older);
          }
        }}
      />
    </label>
    <button class="icon-button" type="button" onclick={onclose} aria-label={t('search.close')} title={t('search.close')}>
      <Icon name="close" />
    </button>
  </div>

  <div class="filters">
    <label>
      <span class="visually-hidden">{t('search.sender')}</span>
      <select bind:value={sender}>
        <option value={null}>{t('search.everyone')}</option>
        {#each people as p (p.i)}
          <option value={p.i}>{p.name}</option>
        {/each}
      </select>
    </label>
    <label>
      <span class="visually-hidden">{t('search.kind')}</span>
      <select bind:value={kind}>
        <option value="all">{t('search.kindAll')}</option>
        <option value="media">{t('search.kindMedia')}</option>
        <option value="links">{t('search.kindLinks')}</option>
      </select>
    </label>
    <label class="date">
      <span>{t('search.from')}</span>
      <input type="date" bind:value={from} min={firstDay} max={to || lastDay} />
    </label>
    <label class="date">
      <span>{t('search.to')}</span>
      <input type="date" bind:value={to} min={from || firstDay} max={lastDay} />
    </label>
  </div>

  {#if !active}
    <p class="hint">{t('search.hint')}</p>
  {:else}
    <div class="count" role="status">
      <span>
        {#if result.total === 0}
          {t('search.none')}
        {:else if cursor != null}
          {t('search.position', { index: cursor + 1, count: result.total })}
        {:else}
          {t('search.results', { count: result.total })}
          {#if result.total > result.hits.length}· {t('search.showing', { count: result.hits.length })}{/if}
        {/if}
      </span>
      {#if result.hits.length}
        <span class="steps">
          <button class="icon-button" type="button" onclick={() => step(false)} aria-label={t('search.newer')} title={t('search.newer')}>
            <Icon name="up" size={18} />
          </button>
          <button class="icon-button" type="button" onclick={() => step(true)} aria-label={t('search.older')} title={t('search.older')}>
            <Icon name="down" size={18} />
          </button>
        </span>
      {/if}
    </div>
    <ol class="results" bind:this={list}>
      {#each shown as i, k (i)}
        {@const m = chat.messages[i] as Message}
        <li>
          <button type="button" class:current={cursor === k} onclick={() => ((cursor = k), onpick(i))}>
            <span class="meta">
              {#if m.sender != null}<span class={`who c${m.sender % 12}`}>{chat.people[m.sender]}</span>{/if}
              <time>{formatDay(dayOf(m.time), locale())} {formatClock(m.time, locale())}</time>
            </span>
            <span class="text">{#each highlight(hitText(m, chat.self, terms), terms) as part, p (p)}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</span>
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
    gap: 6px;
    padding: 10px 10px 6px 14px;
  }

  .field {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--muted);
  }

  .field:focus-within {
    outline: 2px solid var(--accent);
  }

  .field input {
    flex: 1;
    min-width: 0;
    height: 38px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
  }

  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 0 14px 10px;
    border-bottom: 1px solid var(--panel-border);
  }

  .filters label {
    min-width: 0;
  }

  select,
  .date input {
    width: 100%;
    min-height: 34px;
    padding: 4px 6px;
    border: 1px solid var(--panel-border);
    border-radius: var(--radius);
    background: var(--panel);
  }

  .date {
    display: grid;
    gap: 2px;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .hint,
  .count {
    margin: 0;
    padding: 8px 10px 8px 16px;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .count {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
  }

  .steps {
    display: flex;
  }

  .results {
    flex: 1;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .results button {
    display: grid;
    gap: 2px;
    width: 100%;
    padding: 10px 16px;
    border: 0;
    border-bottom: 1px solid var(--panel-border);
    background: transparent;
    text-align: start;
    cursor: pointer;
  }

  .results button:hover {
    background: color-mix(in srgb, var(--text) 5%, transparent);
  }

  .results button.current {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
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
    color: var(--muted);
  }

  .text {
    overflow-wrap: anywhere;
    font-size: 0.9rem;
  }

  mark {
    border-radius: 2px;
    background: var(--mark);
    color: inherit;
  }
</style>
