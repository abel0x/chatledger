<script lang="ts">
  import type { Message } from '../core';
  import { eventText, locale, t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import Bubble from './Bubble.svelte';
  import { dayOf, formatDay } from './format';
  import Icon from './Icon.svelte';
  import LangSwitch from './LangSwitch.svelte';

  let { session, onclose }: { session: Session; onclose: () => void } = $props();

  interface Row {
    m: Message;
    first: boolean;
  }
  interface Day {
    day: number;
    rows: Row[];
  }

  const chat = $derived(session.chat);
  const selfIndex = $derived(chat.self == null ? -1 : chat.people.indexOf(chat.self));
  const isGroup = $derived(chat.people.length > 2 || chat.messages.some(m => m.event && m.event.type !== 'encrypted'));

  /** Days in order, each message marked when it starts a run from one sender. */
  const days = $derived.by(() => {
    const out: Day[] = [];
    let current: Day | undefined;
    let prev: Message | undefined;
    for (const m of chat.messages) {
      const day = dayOf(m.time);
      if (!current || current.day !== day) {
        current = { day, rows: [] };
        out.push(current);
        prev = undefined;
      }
      const first = m.sender == null || !prev || prev.sender !== m.sender;
      current.rows.push({ m, first });
      prev = m;
    }
    return out;
  });

  $effect(() => {
    document.title = `${chat.title ?? t('chat.untitled')} · chatledger`;
    return () => {
      document.title = 'chatledger';
    };
  });
</script>

<div class="chat">
  <header>
    <div class="titles">
      <h1>{chat.title ?? t('chat.untitled')}</h1>
      <p>
        {t('chat.people', { count: chat.people.length })} · {t('chat.messages', { count: chat.messages.length })}
      </p>
    </div>
    <LangSwitch />
    <button class="icon-button" type="button" onclick={onclose} aria-label={t('chat.close')} title={t('chat.close')}>
      <Icon name="close" />
    </button>
  </header>

  {#if session.missing}
    <p class="notice">{t('chat.missing', { count: session.missing })}</p>
  {/if}

  <main class="scroll">
    <div class="column">
      {#each days as d (d.day)}
        <section class="day">
          <h2 class="day-label"><span>{formatDay(d.day, locale())}</span></h2>
          {#each d.rows as r (r.m.id)}
            {#if r.m.kind === 'event' && r.m.event}
              <p class="event" title={r.m.event.raw}>
                {#if r.m.event.type === 'encrypted'}<Icon name="lock" size={14} />{/if}
                {eventText(r.m.event, chat.self)}
              </p>
            {:else}
              <Bubble
                message={r.m}
                {chat}
                {session}
                first={r.first}
                mine={r.m.sender != null && r.m.sender === selfIndex}
                showName={isGroup && r.first && r.m.sender !== selfIndex}
              />
            {/if}
          {/each}
        </section>
      {/each}
    </div>
  </main>
</div>

<style>
  .chat {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
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

  .scroll {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .column {
    max-width: 920px;
    margin: 0 auto;
    padding: 8px 16px 24px;
  }

  .day {
    content-visibility: auto;
    contain-intrinsic-size: auto 900px;
  }

  .day-label {
    position: sticky;
    top: 6px;
    z-index: 1;
    display: flex;
    justify-content: center;
    margin: 12px 0 4px;
    font-size: 0.78rem;
    font-weight: 500;
  }

  .day-label span,
  .event {
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
</style>
