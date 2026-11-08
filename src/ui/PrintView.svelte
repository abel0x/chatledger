<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Chat, Message } from '../core';
  import { eventText, locale, t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import { dayOf, formatClock, formatDay, formatDayRange } from './format';
  import { plainText } from './richtext';

  interface Props {
    chat: Chat;
    session: Session;
    indices: number[];
    pictures: boolean;
    /** Called once everything, pictures included, is on the page. */
    onready: () => void;
  }

  let { chat, session, indices, pictures, onready }: Props = $props();

  /** Pictures are printed from their small copies; the original files can be very large. */
  const MAX_PICTURES = 1000;
  let urls = $state.raw<Map<number, string>>(new Map());
  let root = $state<HTMLDivElement>();

  const messages = $derived(indices.map(i => ({ i, m: chat.messages[i] as Message })));
  const days = $derived.by(() => {
    const out: { day: number; items: typeof messages }[] = [];
    for (const item of messages) {
      const day = dayOf(item.m.time);
      const last = out.at(-1);
      if (last?.day === day) last.items.push(item);
      else out.push({ day, items: [item] });
    }
    return out;
  });

  function body(m: Message): string {
    if (m.kind === 'deleted') return t('msg.deleted');
    if (m.kind === 'omitted') return t('msg.notIncluded', { what: t(`media.${m.media ?? 'unknown'}`) });
    if (m.kind === 'viewOnce') return t('msg.viewOnce');
    if (m.kind === 'pending') return t('msg.pending');
    if (m.poll) return [m.poll.question, ...m.poll.options.map(o => `• ${o.label} (${t('msg.votes', { count: o.votes })})`)].join('\n');
    const file = m.file ? `[${t(`media.${m.media ?? 'unknown'}`)}: ${m.file}]` : '';
    return [file, plainText(m.text ?? '')].filter(Boolean).join('\n');
  }

  function portal(node: HTMLElement) {
    document.body.append(node);
    return { destroy: () => node.remove() };
  }

  onMount(() => {
    void (async () => {
      if (pictures) {
        const wanted = messages.filter(({ m }) => m.kind === 'file' && m.file && (m.media === 'image' || m.media === 'sticker') && session.has(m.file));
        const found = new Map<number, string>();
        for (const { i, m } of wanted.slice(0, MAX_PICTURES)) {
          const th = await session.thumb(m.file ?? '');
          if (th?.url) found.set(i, th.url);
        }
        urls = found;
      }
      await tick();
      await Promise.all([...(root?.querySelectorAll('img') ?? [])].map(img => img.decode().catch(() => {})));
      onready();
    })();
  });
</script>

<div class="print-root" bind:this={root} use:portal>
  <header>
    <h1>{chat.title ?? t('chat.untitled')}</h1>
    {#if messages.length}
      <p>
        {t('chat.messages', { count: messages.length })} ·
        {formatDayRange(messages[0]?.m.time ?? 0, messages.at(-1)?.m.time ?? 0, locale())}
      </p>
    {/if}
  </header>
  {#each days as d (d.day)}
    <section>
      <h2>{formatDay(d.day, locale())}</h2>
      {#each d.items as { i, m } (i)}
        {#if m.event}
          <p class="event"><span class="time">{formatClock(m.time, locale())}</span> {eventText(m.event, chat.self)}</p>
        {:else}
          <div class="msg">
            <span class="time">{formatClock(m.time, locale())}</span>
            <div class="content">
              <strong>{m.sender != null ? chat.people[m.sender] : ''}</strong>
              <p>{body(m)}{m.edited ? ` (${t('msg.edited')})` : ''}</p>
              {#if urls.get(i)}<img src={urls.get(i)} alt="" />{/if}
            </div>
          </div>
        {/if}
      {/each}
    </section>
  {/each}
</div>

<style>
  .print-root {
    font: 10.5pt/1.4 var(--font), var(--emoji);
    color: #000;
    background: #fff;
  }

  header {
    margin-bottom: 12pt;
    padding-bottom: 6pt;
    border-bottom: 1pt solid #999;
  }

  h1 {
    margin: 0;
    font-size: 16pt;
  }

  header p {
    margin: 2pt 0 0;
    color: #444;
  }

  h2 {
    margin: 12pt 0 4pt;
    font-size: 11pt;
    color: #333;
    break-after: avoid;
  }

  .msg {
    display: grid;
    grid-template-columns: 3.4em 1fr;
    gap: 6pt;
    padding: 2pt 0;
    break-inside: avoid;
  }

  .time {
    color: #666;
    font-variant-numeric: tabular-nums;
  }

  .content p {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  img {
    display: block;
    max-width: 8cm;
    max-height: 6cm;
    margin-top: 3pt;
    object-fit: contain;
  }

  .event {
    margin: 3pt 0;
    color: #555;
    font-style: italic;
    break-inside: avoid;
  }
</style>
