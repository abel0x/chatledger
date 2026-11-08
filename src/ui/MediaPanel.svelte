<script lang="ts">
  import type { Chat } from '../core';
  import { locale, t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import { dayOf, formatClock, formatDay, formatMonth } from './format';
  import Icon from './Icon.svelte';
  import { attachments, links, monthOf, type Visual } from './media';
  import StickerTile from './StickerTile.svelte';
  import Tile from './Tile.svelte';

  interface Props {
    chat: Chat;
    session: Session;
    items: Visual[];
    onopen: (position: number) => void;
    onshow: (messageIndex: number) => void;
    onclose: () => void;
  }

  let { chat, session, items, onopen, onshow, onclose }: Props = $props();

  type Tab = 'media' | 'stickers' | 'files' | 'links';
  let tab = $state<Tab>('media');

  const files = $derived(attachments(chat, file => session.has(file)));
  const stickers = $derived(
    chat.messages.flatMap((m, index) => (m.media === 'sticker' && m.file && session.has(m.file) ? [{ index, file: m.file }] : [])).reverse(),
  );
  const urls = $derived(links(chat));

  /** Newest month first, like a phone's gallery. */
  const months = $derived.by(() => {
    const out: { month: number; tiles: { position: number; visual: Visual }[] }[] = [];
    for (let position = items.length - 1; position >= 0; position--) {
      const visual = items[position] as Visual;
      const month = monthOf(chat.messages[visual.index]?.time ?? 0);
      let group = out[out.length - 1];
      if (!group || group.month !== month) {
        group = { month, tiles: [] };
        out.push(group);
      }
      group.tiles.push({ position, visual });
    }
    return out;
  });

  const tabs = $derived<{ id: Tab; label: string; count: number }[]>([
    { id: 'media', label: t('gallery.media'), count: items.length },
    { id: 'stickers', label: t('gallery.stickers'), count: stickers.length },
    { id: 'files', label: t('gallery.files'), count: files.length },
    { id: 'links', label: t('gallery.links'), count: urls.length },
  ]);

  function when(index: number): string {
    const m = chat.messages[index];
    return m ? `${formatDay(dayOf(m.time), locale())} ${formatClock(m.time, locale())}` : '';
  }

  function who(index: number): string {
    const s = chat.messages[index]?.sender;
    return s == null ? '' : (chat.people[s] ?? '');
  }

  async function save(file: string) {
    const url = await session.url(file);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    a.click();
  }

  function hostOf(href: string): string {
    try {
      return new URL(href).hostname.replace(/^www\./, '');
    } catch {
      return href;
    }
  }

  function tabKey(e: KeyboardEvent) {
    const at = tabs.findIndex(x => x.id === tab);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    tab = (tabs[(at + step + tabs.length) % tabs.length] as (typeof tabs)[number]).id;
    (document.getElementById(`tab-${tab}`) as HTMLElement | null)?.focus();
  }
</script>

<aside class="panel" aria-label={t('chat.gallery')}>
  <div class="head">
    <div class="tabs" role="tablist" tabindex="-1" onkeydown={tabKey}>
      {#each tabs as x (x.id)}
        <button
          id={`tab-${x.id}`}
          role="tab"
          type="button"
          aria-selected={tab === x.id}
          aria-controls="gallery-body"
          tabindex={tab === x.id ? 0 : -1}
          onclick={() => (tab = x.id)}
        >
          {x.label} <span class="count">{x.count}</span>
        </button>
      {/each}
    </div>
    <button class="icon-button" type="button" onclick={onclose} aria-label={t('gallery.close')} title={t('gallery.close')}>
      <Icon name="close" />
    </button>
  </div>

  <div class="body" id="gallery-body" role="tabpanel" aria-labelledby={`tab-${tab}`}>
    {#if tab === 'media'}
      {#each months as group (group.month)}
        <h3>{formatMonth(group.month, locale())}</h3>
        <div class="grid">
          {#each group.tiles as tile (tile.position)}
            <Tile visual={tile.visual} {session} onclick={() => onopen(tile.position)} />
          {/each}
        </div>
      {:else}
        <p class="empty">{t('gallery.empty')}</p>
      {/each}
    {:else if tab === 'stickers'}
      <div class="grid stickers">
        {#each stickers as s (s.index)}
          <StickerTile file={s.file} {session} onclick={() => onshow(s.index)} />
        {:else}
          <p class="empty">{t('gallery.empty')}</p>
        {/each}
      </div>
    {:else if tab === 'files'}
      <ul class="rows">
        {#each files.toReversed() as f (f.index)}
          <li>
            <Icon name="file" />
            <div class="main">
              <span class="name">{f.file}</span>
              <span class="meta">{who(f.index)} · {when(f.index)}</span>
            </div>
            <button class="icon-button" type="button" onclick={() => save(f.file)} aria-label={t('msg.download')} title={t('msg.download')}>
              <Icon name="download" />
            </button>
            <button class="icon-button" type="button" onclick={() => onshow(f.index)} aria-label={t('gallery.showInChat')} title={t('gallery.showInChat')}>
              <Icon name="chat" />
            </button>
          </li>
        {:else}
          <li class="empty">{t('gallery.empty')}</li>
        {/each}
      </ul>
    {:else}
      <ul class="rows">
        {#each urls.toReversed() as l, k (k)}
          <li>
            <Icon name="external" />
            <div class="main">
              <a class="name" href={l.href} target="_blank" rel="noopener noreferrer">{hostOf(l.href)}</a>
              <span class="url">{l.text}</span>
              <span class="meta">{who(l.index)} · {when(l.index)}</span>
            </div>
            <button class="icon-button" type="button" onclick={() => onshow(l.index)} aria-label={t('gallery.showInChat')} title={t('gallery.showInChat')}>
              <Icon name="chat" />
            </button>
          </li>
        {:else}
          <li class="empty">{t('gallery.empty')}</li>
        {/each}
      </ul>
    {/if}
  </div>
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
    padding: 8px 10px 0 8px;
    border-bottom: 1px solid var(--panel-border);
  }

  .tabs {
    flex: 1;
    display: flex;
    min-width: 0;
  }

  [role='tab'] {
    flex: 1;
    padding: 10px 6px;
    border: 0;
    border-bottom: 3px solid transparent;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
  }

  [role='tab'][aria-selected='true'] {
    border-bottom-color: var(--accent);
    color: var(--accent);
  }

  .count {
    font-weight: 400;
    font-size: 0.8rem;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  h3 {
    margin: 0;
    padding: 14px 14px 6px;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 4px;
    padding: 0 12px;
  }

  .stickers {
    padding-top: 12px;
  }

  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 6px 8px 14px;
    border-bottom: 1px solid var(--panel-border);
    color: var(--muted);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 1px;
  }

  .name {
    color: var(--text);
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  a.name {
    color: var(--link);
  }

  .url {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.82rem;
  }

  .meta {
    font-size: 0.78rem;
  }

  .empty {
    padding: 16px;
    color: var(--muted);
  }
</style>
