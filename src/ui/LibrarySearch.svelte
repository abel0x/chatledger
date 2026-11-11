<script lang="ts">
  import { onDestroy } from 'svelte';
  import { highlight, parseQuery } from '../core/search';
  import { locale, t } from '../i18n/index.svelte';
  import { openFinder, type Finder, type FinderState } from '../loader/client';
  import type { SavedChat } from '../loader/library';
  import { dayOf, formatClock, formatDay } from './format';
  import { hitText } from './hits';
  import Icon from './Icon.svelte';

  interface Props {
    library: SavedChat[];
    /** Unlocks password-protected chats; a new key means a new finder. */
    libraryKey: CryptoKey | null;
    busy: boolean;
    /** Opens a chat at a message, or with only its search filled in when `message` is null. */
    onpick: (id: string, message: string | null, query: string) => void;
    /** Whether a search is showing, so the plain list can step aside. */
    onactive: (active: boolean) => void;
  }

  let { library, libraryKey, busy, onpick, onactive }: Props = $props();

  let query = $state('');
  let applied = $state('');
  let found = $state.raw<FinderState | null>(null);
  let finder: Finder | null = null;
  let finderKey: CryptoKey | null = null;

  const terms = $derived(parseQuery(applied));
  const active = $derived(terms.length > 0);

  // Typing stays smooth: the search starts once typing pauses.
  $effect(() => {
    const next = query;
    const timer = setTimeout(() => (applied = next), 250);
    return () => clearTimeout(timer);
  });

  $effect(() => onactive(active));

  $effect(() => {
    const ids = library.map(c => c.id);
    const words = applied;
    if (!parseQuery(words).length) {
      found = null;
      return;
    }
    if (finder && finderKey !== libraryKey) {
      finder.close();
      finder = null;
    }
    finderKey = libraryKey;
    finder ??= openFinder(libraryKey);
    finder.search(words, ids, state => (found = state));
  });

  onDestroy(() => finder?.close());

  const titles = $derived(new Map(library.map(c => [c.id, c.title])));
</script>

<div class="everywhere">
  <label class="field">
    <Icon name="search" size={18} />
    <span class="visually-hidden">{t('library.search')}</span>
    <input
      bind:value={query}
      type="search"
      placeholder={t('library.search')}
      autocomplete="off"
      spellcheck="false"
      onkeydown={e => {
        if (e.key === 'Escape') query = applied = '';
        else if (e.key === 'Enter') applied = query;
      }}
    />
  </label>

  {#if active && found}
    <p class="count" role="status">
      {#if !found.finished}
        {t('library.searching', { done: found.done, total: found.total })}
      {:else if !found.chats.length}
        {t('library.none')}
      {:else}
        {t('library.found', { count: found.chats.length })}
      {/if}
    </p>
    {#each found.chats as c (c.id)}
      {@const title = titles.get(c.id) ?? c.title ?? t('chat.untitled')}
      <section class="group" aria-label={title}>
        <h3>
          <span class="title">{title}</span>
          <span class="total">{t('search.results', { count: c.total })}</span>
        </h3>
        <ol>
          {#each c.hits as m (m.id)}
            <li>
              <button type="button" disabled={busy} onclick={() => onpick(c.id, m.id, applied)}>
                <span class="meta">
                  {#if m.sender != null}<span class={`who c${m.sender % 12}`}>{c.people[m.sender]}</span>{/if}
                  <time>{formatDay(dayOf(m.time), locale())} {formatClock(m.time, locale())}</time>
                </span>
                <span class="text">{#each highlight(hitText(m, c.self, terms), terms) as part, p (p)}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</span>
              </button>
            </li>
          {/each}
        </ol>
        {#if c.total > c.hits.length}
          <button class="more" type="button" disabled={busy} onclick={() => onpick(c.id, null, applied)}>
            {t('library.showAll', { count: c.total })}
          </button>
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .everywhere {
    display: grid;
    gap: 10px;
    margin-bottom: 10px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border: 1px solid var(--panel-border);
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
    height: 40px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
  }

  .count {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .group {
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    overflow: hidden;
  }

  h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 8px;
    margin: 0;
    padding: 10px 14px;
    border-bottom: 1px solid var(--panel-border);
    font-size: 0.95rem;
  }

  .title {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .total {
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 400;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  ol button {
    display: grid;
    gap: 2px;
    width: 100%;
    padding: 9px 14px;
    border: 0;
    border-bottom: 1px solid var(--panel-border);
    background: transparent;
    text-align: start;
    cursor: pointer;
  }

  li:last-child button {
    border-bottom: 0;
  }

  ol button:hover,
  .more:hover {
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

  .more {
    width: 100%;
    padding: 9px 14px;
    border: 0;
    border-top: 1px solid var(--panel-border);
    background: transparent;
    color: var(--link);
    font-size: 0.88rem;
    text-align: start;
    cursor: pointer;
  }
</style>
