<script lang="ts">
  import type { Chat, Message } from '../core';
  import { locale, t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import Attachment from './Attachment.svelte';
  import { useChatActions } from './context';
  import { formatClock, formatFull } from './format';
  import Icon from './Icon.svelte';
  import { emojiOnly, richText, type RichNode } from './richtext';
  import { highlight } from './search';

  let {
    message: m,
    index,
    chat,
    session,
    first,
    mine,
    showName,
    terms = [],
    flash = false,
  }: {
    message: Message;
    index: number;
    chat: Chat;
    session: Session;
    first: boolean;
    mine: boolean;
    showName: boolean;
    terms?: string[];
    flash?: boolean;
  } = $props();

  const note = $derived.by(() => {
    switch (m.kind) {
      case 'deleted':
        return mine ? t('msg.deletedBySelf') : t('msg.deleted');
      case 'omitted':
        return t('msg.notIncluded', { what: t(`media.${m.media ?? 'unknown'}`) });
      case 'viewOnce':
        return t('msg.viewOnce');
      case 'pending':
        return t('msg.pending');
      case 'empty':
        return t('msg.empty');
      default:
        return null;
    }
  });

  const total = $derived(m.poll ? m.poll.options.reduce((n, o) => n + o.votes, 0) : 0);
  const nodes = $derived(m.text && !note ? richText(m.text, chat.people) : []);
  const big = $derived(m.kind === 'text' && m.text ? emojiOnly(m.text) : 0);
  const actions = useChatActions();
  const starred = $derived(actions?.isStarred(m.id) ?? false);
</script>

{#snippet marked(text: string)}{#each highlight(text, terms) as part, k (k)}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}{/snippet}

{#snippet rich(list: RichNode[])}{#each list as n, k (k)}{#if n.t === 'text'}{@render marked(n.v)}{:else if n.t === 'link'}<a href={n.href} target="_blank" rel="noopener noreferrer">{@render marked(n.v)}</a>{:else if n.t === 'mention'}{#if n.person != null}<button type="button" class={`mention c${n.person % 12}`} onclick={() => actions?.searchPerson(n.person ?? 0)}>{n.v}</button>{:else}<span class="mention">{n.v}</span>{/if}{:else if n.t === 'block'}<code class="block">{n.v}</code>{:else if n.s === 'b'}<strong>{@render rich(n.c)}</strong>{:else if n.s === 'i'}<em>{@render rich(n.c)}</em>{:else if n.s === 's'}<s>{@render rich(n.c)}</s>{:else}<code>{@render rich(n.c)}</code>{/if}{/each}{/snippet}

<div class="row" class:mine class:first class:flash id={`m-${m.id}`}>
  <div class="bubble" class:bare={big > 0 || (m.kind === 'file' && m.media === 'sticker')}>
    {#if actions}
      <button
        class="more"
        type="button"
        aria-label={t('msg.options')}
        title={t('msg.options')}
        aria-haspopup="menu"
        onclick={e => actions.openMenu(index, e.currentTarget)}
      >
        <Icon name="chevron" size={18} />
      </button>
    {/if}
    {#if showName && m.sender != null}
      <div class={`sender c${m.sender % 12}`}>{chat.people[m.sender]}</div>
    {/if}

    {#if m.kind === 'file' && m.file}
      <Attachment file={m.file} media={m.media} {index} {session} />
    {/if}

    {#if m.kind === 'poll' && m.poll}
      <div class="poll">
        <div class="label"><Icon name="poll" size={16} /> {t('msg.poll')}</div>
        <strong>{m.poll.question}</strong>
        {#each m.poll.options as o, i (i)}
          <div class="option">
            <span>{o.label}</span>
            <span class="votes">{t('msg.votes', { count: o.votes })}</span>
            <progress max={total || 1} value={o.votes}></progress>
          </div>
        {/each}
      </div>
    {/if}

    {#if m.kind === 'location'}
      <div class="label"><Icon name="pin" size={16} /> {t('msg.location')}</div>
    {/if}

    <div class="body">
      {#if note}
        <span class="note">
          <Icon name={m.kind === 'deleted' ? 'blocked' : m.kind === 'pending' ? 'clock' : 'file'} size={15} />
          {note}
        </span>
      {:else if m.text}
        <span class={`text${big ? ` jumbo${big}` : ''}`}>{@render rich(nodes)}</span>
      {/if}
      <span class="meta">
        {#if starred}<span class="star" title={t('msg.starred')}><Icon name="star" size={12} filled /></span>{/if}
        {#if m.edited}<span>{t('msg.edited')}</span>{/if}
        <time datetime={new Date(m.time * 1000).toISOString().slice(0, 19)} title={formatFull(m.time, locale())}>
          {formatClock(m.time, locale())}
        </time>
      </span>
    </div>
  </div>
</div>

<style>
  .row {
    display: flex;
    padding: 1px 0;
  }

  .row.first {
    padding-top: 9px;
  }

  .more {
    position: absolute;
    top: 2px;
    inset-inline-end: 2px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: inherit;
    color: var(--muted);
    opacity: 0;
    cursor: pointer;
  }

  .bubble:hover .more,
  .more:focus-visible,
  .more:global([aria-expanded='true']) {
    opacity: 1;
  }

  @media (hover: none) {
    .more {
      opacity: 0.6;
    }
  }

  .bubble.bare {
    background: transparent;
    box-shadow: none;
  }

  .jumbo1 {
    font-size: 3rem;
    line-height: 1.15;
  }

  .jumbo2 {
    font-size: 2.5rem;
    line-height: 1.15;
  }

  .jumbo3 {
    font-size: 2rem;
    line-height: 1.15;
  }

  .mention {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  span.mention {
    color: var(--link);
    cursor: default;
  }

  .text code {
    padding: 0 3px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--text) 8%, transparent);
    font-family: ui-monospace, 'Cascadia Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace;
    font-size: 0.92em;
  }

  .text code.block {
    display: block;
    margin: 2px 0;
    padding: 6px 8px;
    white-space: pre-wrap;
  }

  .star {
    display: inline-flex;
    align-items: center;
  }

  .flash .bubble {
    animation: flash 2s ease-out;
  }

  @keyframes flash {
    0%,
    40% {
      box-shadow: 0 0 0 3px var(--accent);
    }
    100% {
      box-shadow: var(--shadow);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flash .bubble {
      animation: none;
      box-shadow: 0 0 0 3px var(--accent);
    }
  }

  mark {
    border-radius: 2px;
    background: var(--mark);
    color: inherit;
  }

  .row.mine {
    justify-content: flex-end;
  }

  .bubble {
    position: relative;
    max-width: min(560px, 82%);
    padding: 6px 8px 6px 9px;
    border-radius: var(--radius);
    background: var(--bubble-in);
    box-shadow: var(--shadow);
    overflow-wrap: anywhere;
  }

  .mine .bubble {
    background: var(--bubble-out);
  }

  .first .bubble {
    border-start-start-radius: 0;
  }

  .first.mine .bubble {
    border-start-start-radius: var(--radius);
    border-start-end-radius: 0;
  }

  .sender {
    margin-bottom: 2px;
    font-size: 0.86rem;
    font-weight: 600;
  }

  .body::after {
    content: '';
    display: block;
    clear: both;
  }

  .text {
    white-space: pre-wrap;
  }

  .note {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
    font-style: italic;
  }

  .meta {
    float: right;
    display: inline-flex;
    gap: 6px;
    margin: 6px 0 -4px 12px;
    color: var(--muted);
    font-size: 0.7rem;
    line-height: 1.4;
    white-space: nowrap;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
    font-size: 0.86rem;
  }

  .poll {
    display: grid;
    gap: 6px;
    min-width: min(260px, 100%);
    margin-bottom: 4px;
  }

  .option {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
  }

  .votes {
    color: var(--muted);
    font-size: 0.85rem;
  }

  progress {
    grid-column: 1 / -1;
    width: 100%;
    height: 6px;
    accent-color: var(--accent);
  }
</style>
