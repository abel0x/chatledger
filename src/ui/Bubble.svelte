<script lang="ts">
  import type { Chat, Message } from '../core';
  import { locale, t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import Attachment from './Attachment.svelte';
  import { formatClock, formatFull } from './format';
  import Icon from './Icon.svelte';
  import { linkify } from './linkify';
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
</script>

{#snippet marked(text: string)}{#each highlight(text, terms) as part, k (k)}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}{/snippet}

<div class="row" class:mine class:first class:flash id={`m-${m.id}`}>
  <div class="bubble">
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
        <span class="text">{#each linkify(m.text) as p, i (i)}{#if p.href}<a href={p.href} target="_blank" rel="noopener noreferrer">{@render marked(p.text)}</a>{:else}{@render marked(p.text)}{/if}{/each}</span>
      {/if}
      <span class="meta">
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
