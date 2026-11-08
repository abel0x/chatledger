<script lang="ts">
  import { onMount } from 'svelte';
  import type { Message } from '../core';
  import { eventText, locale, t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import type { LoadErrorCode } from '../loader/open';
  import Bubble from './Bubble.svelte';
  import { provideChatActions } from './context';
  import DocViewer from './DocViewer.svelte';
  import { formatDay } from './format';
  import Icon, { type IconName } from './Icon.svelte';
  import InfoPanel from './InfoPanel.svelte';
  import KeysDialog from './KeysDialog.svelte';
  import Lightbox from './Lightbox.svelte';
  import { visuals } from './media';
  import MediaPanel from './MediaPanel.svelte';
  import Menu, { type MenuItem } from './Menu.svelte';
  import { plainText } from './richtext';
  import { buildRows, estimateHeight, type Row } from './rows';
  import { SearchIndex } from './search';
  import SearchPanel from './SearchPanel.svelte';
  import { readSetting, writeSetting } from './settings';
  import SettingsPopover, { type Shortcut } from './SettingsPopover.svelte';
  import StarredPanel from './StarredPanel.svelte';
  import { chatKey, Stars } from './stars.svelte';
  import StatsView from './StatsView.svelte';
  import TimeRail from './TimeRail.svelte';
  import Toast from './Toast.svelte';
  import VirtualList from './VirtualList.svelte';

  let {
    session,
    onclose,
    onaddexport,
  }: { session: Session; onclose: () => void; onaddexport?: (files: File[]) => Promise<LoadErrorCode | null> } = $props();

  type Panel = 'search' | 'gallery' | 'starred' | 'info';

  const chat = $derived(session.chat);
  const key = $derived(chatKey(chat));
  const stars = $derived(new Stars(key));
  const selfIndex = $derived(chat.self == null ? -1 : chat.people.indexOf(chat.self));
  const isGroup = $derived(chat.people.length > 2 || chat.messages.some(m => m.event && m.event.type !== 'encrypted'));
  const layout = $derived(buildRows(chat.messages));
  const index = $derived(new SearchIndex(chat));
  const firstDay = $derived(layout.rows[0]?.day ?? 0);
  const lastDay = $derived(layout.rows[layout.rows.length - 1]?.day ?? 0);
  const gallery = $derived(visuals(chat, file => session.has(file)));
  const byId = $derived(new Map(chat.messages.map((m, i) => [m.id, i])));
  const activeDays = $derived.by(() => {
    const counts = new Map<number, number>();
    for (const m of chat.messages) {
      if (m.sender == null) continue;
      const day = Math.floor(m.time / 86400);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts].map(([day, count]) => ({ day, count })).sort((a, b) => a.day - b.day);
  });

  let list = $state<ReturnType<typeof VirtualList>>();
  let searchPanel = $state<ReturnType<typeof SearchPanel>>();
  let dateInput = $state<HTMLInputElement>();
  let settingsButton = $state<HTMLButtonElement>();
  let firstRow = $state(0);
  let atStart = $state(true);
  let atEnd = $state(false);
  let panel = $state<Panel | null>(null);
  let searchPerson = $state<number | null>(null);
  let viewer = $state<number | null>(null);
  let docIndex = $state<number | null>(null);
  let menu = $state<{ index: number; anchor: HTMLElement } | null>(null);
  let toast = $state<string | null>(null);
  let showStats = $state(false);
  let showKeys = $state(false);
  let settingsOpen = $state(false);
  let narrow = $state(false);
  let terms = $state<string[]>([]);
  let flashKey = $state<string | null>(null);
  let scrolling = $state(false);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const currentDay = $derived(layout.rows[firstRow]?.day ?? firstDay);
  const searching = $derived(panel === 'search');

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

  function say(message: string) {
    clearTimeout(toastTimer);
    toast = message;
    toastTimer = setTimeout(() => (toast = null), 2600);
  }

  function flash(id: string) {
    clearTimeout(flashTimer);
    flashKey = id;
    flashTimer = setTimeout(() => (flashKey = null), 2200);
  }

  /** Brings a message to the middle of the screen and marks it, also in the address for a link. */
  function pick(messageIndex: number) {
    const m = chat.messages[messageIndex];
    if (!m) return;
    viewer = null;
    showStats = false;
    if (narrow) panel = null;
    list?.scrollToIndex(layout.rowOf[messageIndex] ?? 0, 'center');
    flash(m.id);
    history.replaceState(null, '', `#m-${m.id}`);
  }

  function goToDay(day: number) {
    let row = layout.rows.findIndex(r => r.kind === 'day' && r.day >= day);
    if (row < 0) row = layout.rows.length - 1;
    list?.scrollToIndex(row, 'start');
  }

  function viewChanged(first: number, start: boolean, end: boolean) {
    if (first !== firstRow) {
      scrolling = true;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => (scrolling = false), 1500);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(savePosition, 400);
    }
    firstRow = first;
    atStart = start;
    atEnd = end;
  }

  /** Remembers where the reader is, so the chat opens there next time. */
  function savePosition() {
    let row = firstRow;
    while (rowAt(row)?.kind === 'day') row++;
    const id = rowAt(row)?.key;
    if (id) writeSetting(`pos.${key}`, id);
  }

  function isoDay(day: number): string {
    return new Date(day * 86400000).toISOString().slice(0, 10);
  }

  function openDatePicker() {
    if (!dateInput) return;
    try {
      dateInput.showPicker();
    } catch {
      dateInput.focus();
    }
  }

  function toggle(which: Panel) {
    if (which === 'search' && searching) {
      searchPanel?.focus();
      return;
    }
    searchPerson = null;
    panel = panel === which ? null : which;
  }

  function messageText(m: Message): string {
    if (m.event) return eventText(m.event, chat.self);
    if (m.poll) return [m.poll.question, ...m.poll.options.map(o => `${o.label} (${o.votes})`)].join('\n');
    return plainText(m.text ?? m.file ?? '');
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      say(done);
    } catch {
      say(t('toast.copyFailed'));
    }
  }

  function linkTo(m: Message): string {
    return `${location.origin}${location.pathname}#m-${m.id}`;
  }

  const menuItems = $derived.by((): MenuItem[] => {
    const m = menu ? chat.messages[menu.index] : undefined;
    if (!m) return [];
    const starred = stars.has(m.id);
    const items: MenuItem[] = [
      {
        label: starred ? t('menu.unstar') : t('menu.star'),
        icon: 'star',
        run: () => say(stars.toggle(m.id) ? t('toast.starred') : t('toast.unstarred')),
      },
    ];
    if (messageText(m)) items.push({ label: t('menu.copyText'), icon: 'copy', run: () => copy(messageText(m), t('toast.textCopied')) });
    items.push({ label: t('menu.copyLink'), icon: 'link', run: () => copy(linkTo(m), t('toast.linkCopied')) });
    return items;
  });

  const extra = $derived.by((): Shortcut[] =>
    narrow
      ? [
          { label: t('chat.starred'), icon: 'star', run: () => toggle('starred') },
          { label: t('chat.info'), icon: 'info', run: () => toggle('info') },
          { label: t('chat.stats'), icon: 'chart', run: () => (showStats = !showStats) },
          { label: t('chat.jumpToDate'), icon: 'calendar', run: openDatePicker },
        ]
      : [],
  );

  provideChatActions({
    openMedia(messageIndex) {
      const at = gallery.findIndex(v => v.index === messageIndex);
      if (at >= 0) viewer = at;
    },
    openDocument(messageIndex) {
      docIndex = messageIndex;
    },
    showMessage: pick,
    searchPerson(person) {
      searchPerson = person;
      panel = 'search';
    },
    openMenu(messageIndex, anchor) {
      menu = menu?.index === messageIndex ? null : { index: messageIndex, anchor };
    },
    isStarred: id => stars.has(id),
  });

  function typing(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }

  function keydown(e: KeyboardEvent) {
    if (viewer != null || docIndex != null || showKeys) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggle('search');
      return;
    }
    if (e.key === 'Escape') {
      if (menu || settingsOpen) return;
      if (panel) panel = null;
      else if (showStats) showStats = false;
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    const k = e.key;
    const onSlider = !!(e.target as HTMLElement | null)?.closest?.('[role=slider]');
    const run = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    if (k === '/') run(() => toggle('search'));
    else if (k === '?') run(() => (showKeys = true));
    else if (k === 'd' || k === 'D') run(openDatePicker);
    else if (k === 's' || k === 'S') run(() => toggle('starred'));
    else if (k === 'm' || k === 'M') run(() => toggle('gallery'));
    else if (['i', 'I', 'ı', 'İ'].includes(k)) run(() => toggle('info'));
    else if (k === 't' || k === 'T') run(() => (showStats = !showStats));
    else if (k === 'Home' && !onSlider) run(() => list?.scrollToIndex(0));
    else if (k === 'End' && !onSlider) run(() => list?.scrollToIndex(layout.rows.length - 1, 'end'));
  }

  function fromHash(): boolean {
    const match = /^#m-([\w-]+)$/.exec(location.hash);
    const at = match ? byId.get(match[1] ?? '') : undefined;
    if (at == null) return false;
    pick(at);
    return true;
  }

  onMount(() => {
    const media = matchMedia('(max-width: 760px)');
    const update = () => (narrow = media.matches);
    update();
    media.addEventListener('change', update);
    window.addEventListener('hashchange', fromHash);
    index.prepare();
    // A link to a message wins; otherwise open where the reader stopped last time.
    requestAnimationFrame(() => {
      if (fromHash()) return;
      const saved = byId.get(readSetting(`pos.${key}`) ?? '');
      if (saved != null) list?.scrollToIndex(layout.rowOf[saved] ?? 0, 'start');
    });
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('hashchange', fromHash);
      for (const timer of [flashTimer, scrollTimer, toastTimer, saveTimer]) clearTimeout(timer);
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    };
  });

  $effect(() => {
    document.title = `${chat.title ?? t('chat.untitled')} · chatledger`;
    return () => {
      document.title = 'chatledger';
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

{#snippet headerButton(label: string, icon: IconName, onclick: () => void, pressed: boolean, secondary: boolean)}
  <button class="icon-button" class:secondary type="button" {onclick} aria-label={label} title={label} aria-pressed={pressed}>
    <Icon name={icon} />
  </button>
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
      {@render headerButton(t('chat.search'), 'search', () => toggle('search'), searching, false)}
      {@render headerButton(t('chat.gallery'), 'image', () => toggle('gallery'), panel === 'gallery', false)}
      {@render headerButton(t('chat.starred'), 'star', () => toggle('starred'), panel === 'starred', true)}
      {@render headerButton(t('chat.info'), 'info', () => toggle('info'), panel === 'info', true)}
      {@render headerButton(showStats ? t('chat.backToChat') : t('chat.stats'), showStats ? 'chat' : 'chart', () => (showStats = !showStats), showStats, true)}
      {@render headerButton(t('chat.jumpToDate'), 'calendar', openDatePicker, false, true)}
      <div class="settings">
        <button
          class="icon-button"
          type="button"
          bind:this={settingsButton}
          onclick={() => (settingsOpen = !settingsOpen)}
          aria-label={narrow ? t('chat.more') : t('settings.label')}
          title={narrow ? t('chat.more') : t('settings.label')}
          aria-haspopup="dialog"
        >
          <Icon name={narrow ? 'dots' : 'settings'} />
        </button>
        {#if settingsOpen && settingsButton}
          <SettingsPopover anchor={settingsButton} {extra} onkeys={() => (showKeys = true)} onclose={() => (settingsOpen = false)} />
        {/if}
      </div>
      <button class="icon-button" type="button" onclick={onclose} aria-label={t('chat.close')} title={t('chat.close')}>
        <Icon name="close" />
      </button>
    </header>

    {#if session.missing}
      <p class="notice">{t('chat.missing', { count: session.missing })}</p>
    {/if}

    <div class="stage">
      <div class="list">
        <VirtualList bind:this={list} count={layout.rows.length} {estimate} key={i => rowAt(i).key} {item} label={t('chat.list')} onview={viewChanged} />

        {#if !atStart}
          <button class="day-float" class:idle={!scrolling} type="button" onclick={openDatePicker} title={t('chat.jumpToDate')} tabindex="-1">
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
          onchange={e => {
            const ms = Date.parse(`${e.currentTarget.value}T00:00:00Z`);
            if (!Number.isNaN(ms)) goToDay(Math.floor(ms / 86400000));
          }}
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
          <div class="overlay"><StatsView {chat} load={() => session.stats()} onshow={pick} /></div>
        {/if}
      </div>
      {#if activeDays.length > 1 && !showStats}
        <TimeRail days={activeDays} current={currentDay} onjump={goToDay} />
      {/if}
    </div>
  </div>

  {#if panel === 'search'}
    <SearchPanel
      bind:this={searchPanel}
      {chat}
      {index}
      person={searchPerson}
      onpick={pick}
      onclose={() => (panel = null)}
      onterms={next => (terms = next)}
    />
  {:else if panel === 'gallery'}
    <MediaPanel {chat} {session} items={gallery} onopen={at => (viewer = at)} onshow={pick} onclose={() => (panel = null)} />
  {:else if panel === 'starred'}
    <StarredPanel {chat} {stars} onpick={pick} onclose={() => (panel = null)} ontoast={say} />
  {:else if panel === 'info'}
    <InfoPanel
      {chat}
      onadd={onaddexport
        ? async files => {
            const failed = await onaddexport(files);
            if (failed) say(t(`error.${failed}`));
          }
        : undefined}
      onpick={pick}
      onperson={person => {
        searchPerson = person;
        panel = 'search';
      }}
      onclose={() => (panel = null)}
    />
  {/if}
</div>

{#if viewer != null}
  <Lightbox items={gallery} start={viewer} {chat} {session} onclose={() => (viewer = null)} onshow={pick} />
{/if}
{#if docIndex != null && chat.messages[docIndex]?.file}
  <DocViewer file={chat.messages[docIndex]?.file ?? ''} {session} onclose={() => (docIndex = null)} />
{/if}
{#if menu}
  <Menu items={menuItems} anchor={menu.anchor} label={t('msg.options')} onclose={() => (menu = null)} />
{/if}
{#if showKeys}
  <KeysDialog onclose={() => (showKeys = false)} />
{/if}
<Toast message={toast} />

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

    .secondary {
      display: none;
    }
  }

  .main {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 8px 8px 16px;
    background: var(--panel);
    border-bottom: 1px solid var(--panel-border);
  }

  .titles {
    flex: 1;
    min-width: 0;
    margin-inline-end: 6px;
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-button[aria-pressed='true'] {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--accent);
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
    display: flex;
    min-height: 0;
  }

  .list {
    position: relative;
    flex: 1;
    min-width: 0;
  }

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
    right: 16px;
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
