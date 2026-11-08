<script lang="ts">
  import type { Message } from '../core';
  import { eventText, locale, t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import Bubble from './Bubble.svelte';
  import { provideChatActions } from './context';
  import { formatDay } from './format';
  import Icon from './Icon.svelte';
  import LangSwitch from './LangSwitch.svelte';
  import Lightbox from './Lightbox.svelte';
  import { visuals } from './media';
  import MediaPanel from './MediaPanel.svelte';
  import { buildRows, estimateHeight, type Row } from './rows';
  import { SearchIndex } from './search';
  import SearchPanel from './SearchPanel.svelte';
  import StatsView from './StatsView.svelte';
  import VirtualList from './VirtualList.svelte';

  let { session, onclose }: { session: Session; onclose: () => void } = $props();

  const chat = $derived(session.chat);
  const selfIndex = $derived(chat.self == null ? -1 : chat.people.indexOf(chat.self));
  const isGroup = $derived(chat.people.length > 2 || chat.messages.some(m => m.event && m.event.type !== 'encrypted'));
  const layout = $derived(buildRows(chat.messages));
  const index = $derived(new SearchIndex(chat));
  const firstDay = $derived(layout.rows[0]?.day ?? 0);
  const lastDay = $derived(layout.rows[layout.rows.length - 1]?.day ?? 0);
  const gallery = $derived(visuals(chat, file => session.has(file)));

  let list = $state<ReturnType<typeof VirtualList>>();
  let searchPanel = $state<ReturnType<typeof SearchPanel>>();
  let dateInput = $state<HTMLInputElement>();
  let firstRow = $state(0);
  let atStart = $state(true);
  let atEnd = $state(false);
  let panel = $state<'search' | 'gallery' | null>(null);
  let viewer = $state<number | null>(null);
  let showStats = $state(false);
  const searching = $derived(panel === 'search');
  let terms = $state<string[]>([]);
  let flashKey = $state<string | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let scrolling = $state(false);
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;

  const currentDay = $derived(layout.rows[firstRow]?.day ?? firstDay);

  function rowAt(i: number): Row {
    return layout.rows[i] as Row;
  }

  function nameShown(row: Row, m: Message): boolean {
    return isGroup && row.kind === 'message' && row.first && m.sender !== selfIndex;
  }

  function estimate(i: number): number {
    const row = rowAt(i);
    const m = row.kind === 'day' ? undefined : chat.messages[row.index];
    return estimateHeight(row, m, m ? nameShown(row, m) : false);
  }

  function flash(key: string) {
    clearTimeout(flashTimer);
    flashKey = key;
    flashTimer = setTimeout(() => (flashKey = null), 2200);
  }

  function pick(messageIndex: number) {
    const m = chat.messages[messageIndex];
    if (!m) return;
    viewer = null;
    showStats = false;
    if (matchMedia('(max-width: 760px)').matches) panel = null;
    list?.scrollToIndex(layout.rowOf[messageIndex] ?? 0, 'center');
    flash(m.id);
  }

  provideChatActions({
    openMedia(messageIndex) {
      const at = gallery.findIndex(v => v.index === messageIndex);
      if (at >= 0) viewer = at;
    },
    showMessage: pick,
  });

  function viewChanged(first: number, start: boolean, end: boolean) {
    if (first !== firstRow) {
      scrolling = true;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => (scrolling = false), 1500);
    }
    firstRow = first;
    atStart = start;
    atEnd = end;
  }

  function isoDay(day: number): string {
    return new Date(day * 86400000).toISOString().slice(0, 10);
  }

  function goToDate(value: string) {
    const ms = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(ms)) return;
    const day = Math.floor(ms / 86400000);
    let row = layout.rows.findIndex(r => r.kind === 'day' && r.day >= day);
    if (row < 0) row = layout.rows.length - 1;
    list?.scrollToIndex(row, 'start');
  }

  function openDatePicker() {
    if (!dateInput) return;
    try {
      dateInput.showPicker();
    } catch {
      dateInput.focus();
    }
  }

  function openSearch() {
    if (searching) searchPanel?.focus();
    panel = 'search';
  }

  function togglePanel(which: 'search' | 'gallery') {
    if (which === 'search') openSearch();
    else panel = panel === which ? null : which;
  }

  function keydown(e: KeyboardEvent) {
    if (viewer != null) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      openSearch();
    } else if (e.key === 'Escape' && panel) {
      panel = null;
    } else if (e.key === 'Escape' && showStats) {
      showStats = false;
    }
  }

  $effect(() => {
    index.prepare();
  });

  $effect(() => {
    document.title = `${chat.title ?? t('chat.untitled')} · chatledger`;
    return () => {
      document.title = 'chatledger';
      clearTimeout(flashTimer);
      clearTimeout(scrollTimer);
    };
  });
</script>

<svelte:window onkeydown={keydown} />

{#snippet item(i: number)}
  {@const row = rowAt(i)}
  {#if row.kind === 'day'}
    <h2 class="day-label"><span>{formatDay(row.day, locale())}</span></h2>
  {:else if row.kind === 'event'}
    {@const ev = chat.messages[row.index]?.event}
    {#if ev}
      <p class="event" class:flash={flashKey === row.key} title={ev.raw}>
        {#if ev.type === 'encrypted'}<Icon name="lock" size={14} />{/if}
        {eventText(ev, chat.self)}
      </p>
    {/if}
  {:else}
    {@const m = chat.messages[row.index] as Message}
    <Bubble
      message={m}
      index={row.index}
      {chat}
      {session}
      first={row.first}
      mine={m.sender != null && m.sender === selfIndex}
      showName={nameShown(row, m)}
      terms={searching ? terms : []}
      flash={flashKey === row.key}
    />
  {/if}
{/snippet}

<div class="chat" class:with-panel={panel != null}>
  <div class="main">
    <header>
      <div class="titles">
        <h1>{chat.title ?? t('chat.untitled')}</h1>
        <p>
          {t('chat.people', { count: chat.people.length })} · {t('chat.messages', { count: chat.messages.length })}
        </p>
      </div>
      <button class="icon-button" type="button" onclick={() => togglePanel('search')} aria-label={t('chat.search')} title={t('chat.search')} aria-pressed={searching}>
        <Icon name="search" />
      </button>
      <button
        class="icon-button"
        type="button"
        onclick={() => togglePanel('gallery')}
        aria-label={t('chat.gallery')}
        title={t('chat.gallery')}
        aria-pressed={panel === 'gallery'}
      >
        <Icon name="image" />
      </button>
      <button
        class="icon-button"
        type="button"
        onclick={() => (showStats = !showStats)}
        aria-label={showStats ? t('chat.backToChat') : t('chat.stats')}
        title={showStats ? t('chat.backToChat') : t('chat.stats')}
        aria-pressed={showStats}
      >
        <Icon name={showStats ? 'chat' : 'chart'} />
      </button>
      <button class="icon-button" type="button" onclick={openDatePicker} aria-label={t('chat.jumpToDate')} title={t('chat.jumpToDate')}>
        <Icon name="calendar" />
      </button>
      <LangSwitch />
      <button class="icon-button" type="button" onclick={onclose} aria-label={t('chat.close')} title={t('chat.close')}>
        <Icon name="close" />
      </button>
    </header>

    {#if session.missing}
      <p class="notice">{t('chat.missing', { count: session.missing })}</p>
    {/if}

    <div class="stage">
      <VirtualList
        bind:this={list}
        count={layout.rows.length}
        {estimate}
        key={i => rowAt(i).key}
        {item}
        label={t('chat.list')}
        onview={viewChanged}
      />

      {#if !atStart}
        <button
          class="day-float"
          class:idle={!scrolling}
          type="button"
          onclick={openDatePicker}
          title={t('chat.jumpToDate')}
          tabindex="-1"
        >
          {formatDay(currentDay, locale())}
        </button>
      {/if}
      <input
        class="date-input"
        type="date"
        bind:this={dateInput}
        min={isoDay(firstDay)}
        max={isoDay(lastDay)}
        value={isoDay(currentDay)}
        onchange={e => goToDate(e.currentTarget.value)}
        tabindex="-1"
        aria-label={t('chat.jumpToDate')}
      />

      <div class="jumps">
        {#if !atStart}
          <button class="jump" type="button" onclick={() => list?.scrollToIndex(0)} aria-label={t('chat.first')} title={t('chat.first')}>
            <Icon name="up" />
          </button>
        {/if}
        {#if !atEnd}
          <button
            class="jump"
            type="button"
            onclick={() => list?.scrollToIndex(layout.rows.length - 1, 'end')}
            aria-label={t('chat.latest')}
            title={t('chat.latest')}
          >
            <Icon name="down" />
          </button>
        {/if}
      </div>
      {#if showStats}
        <div class="overlay"><StatsView {chat} /></div>
      {/if}
    </div>
  </div>

  {#if panel === 'search'}
    <SearchPanel bind:this={searchPanel} {chat} {index} onpick={pick} onclose={() => (panel = null)} onterms={next => (terms = next)} />
  {:else if panel === 'gallery'}
    <MediaPanel {chat} {session} items={gallery} onopen={at => (viewer = at)} onshow={pick} onclose={() => (panel = null)} />
  {/if}
</div>

{#if viewer != null}
  <Lightbox items={gallery} start={viewer} {chat} {session} onclose={() => (viewer = null)} onshow={pick} />
{/if}

<style>
  .chat {
    --vl-max-width: 920px;
    --vl-gutter: 16px;
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    height: 100%;
  }

  .chat.with-panel {
    grid-template-columns: minmax(0, 1fr) min(400px, 40vw);
  }

  @media (max-width: 760px) {
    .chat.with-panel {
      grid-template-columns: minmax(0, 1fr);
    }

    .chat.with-panel > :global(.panel) {
      position: absolute;
      inset: 0;
      z-index: 5;
    }
  }

  .main {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px 8px 16px;
    background: var(--panel);
    border-bottom: 1px solid var(--panel-border);
  }

  .titles {
    flex: 1;
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .titles p {
    margin: 0;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .notice {
    margin: 0;
    padding: 6px 16px;
    background: var(--panel);
    border-bottom: 1px solid var(--panel-border);
    color: var(--muted);
    font-size: 0.85rem;
    text-align: center;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  /* Laid over the list, which stays as it was so the reading position survives. */
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 4;
  }

  .day-label {
    display: flex;
    justify-content: center;
    margin: 0;
    padding: 12px 0 4px;
    font-size: 0.78rem;
    font-weight: 500;
  }

  .day-label span,
  .event,
  .day-float {
    padding: 5px 12px;
    border-radius: var(--radius);
    background: var(--pill);
    box-shadow: var(--shadow);
    color: var(--muted);
  }

  .event {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: fit-content;
    max-width: 90%;
    margin: 8px auto;
    font-size: 0.8rem;
    text-align: center;
  }

  .event.flash {
    outline: 3px solid var(--accent);
  }

  .day-float {
    position: absolute;
    top: 8px;
    left: 50%;
    z-index: 2;
    transform: translateX(-50%);
    border: 0;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.3s;
  }

  .day-float.idle {
    opacity: 0;
    pointer-events: none;
  }

  .date-input {
    position: absolute;
    top: 8px;
    left: 50%;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .jumps {
    position: absolute;
    right: 20px;
    bottom: 20px;
    z-index: 2;
    display: grid;
    gap: 8px;
  }

  .jump {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border: 0;
    border-radius: 50%;
    background: var(--panel);
    box-shadow: 0 1px 3px #0b141a40;
    color: var(--muted);
    cursor: pointer;
  }
</style>
