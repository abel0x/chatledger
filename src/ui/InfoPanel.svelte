<script lang="ts">
  import type { Chat } from '../core';
  import { locale, t } from '../i18n/index.svelte';
  import { dayOf, formatDay } from './format';
  import { groupInfo, onThisDay, randomMessage } from './groupinfo';
  import Icon from './Icon.svelte';

  interface Props {
    chat: Chat;
    onadd?: (files: File[]) => Promise<void>;
    onpick: (messageIndex: number) => void;
    onperson: (person: number) => void;
    onclose: () => void;
  }

  let { chat, onadd, onpick, onperson, onclose }: Props = $props();

  let adding = $state(false);
  let picker = $state<HTMLInputElement>();

  async function picked(e: Event & { currentTarget: HTMLInputElement }) {
    const files = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = '';
    if (!files.length || !onadd) return;
    adding = true;
    try {
      await onadd(files);
    } finally {
      adding = false;
    }
  }

  const info = $derived(groupInfo(chat));
  const past = $derived(onThisDay(chat, new Date()));
  const inGroup = $derived(info.members.filter(m => m.inGroup));
  const left = $derived(info.members.filter(m => !m.inGroup));
  const who = (name: string | null) => name ?? t('party.you');
  const when = (time: number) => formatDay(dayOf(time), locale());

  function random() {
    const index = randomMessage(chat);
    if (index != null) onpick(index);
  }
</script>

{#snippet member(m: (typeof info.members)[number])}
  <li>
    {#if m.person != null}
      <button type="button" onclick={() => onperson(m.person ?? 0)} title={t('info.searchPerson', { name: m.name ?? '' })}>
        <span class={`dot c${m.person % 12}`} aria-hidden="true"></span>
        <span class="name">{who(m.name)}</span>
        <span class="count">{t('chat.messages', { count: m.messages })}</span>
      </button>
    {:else}
      <span class="static"><span class="dot" aria-hidden="true"></span><span class="name">{who(m.name)}</span></span>
    {/if}
  </li>
{/snippet}

<aside class="panel" aria-label={t('chat.info')}>
  <div class="head">
    <h2><Icon name="info" size={18} /> {t('chat.info')}</h2>
    <button class="icon-button" type="button" onclick={onclose} aria-label={t('gallery.close')} title={t('gallery.close')}>
      <Icon name="close" />
    </button>
  </div>

  <div class="body">
    <section>
      <h3>{chat.title ?? t('chat.untitled')}</h3>
      {#if info.created}
        <button class="link" type="button" onclick={() => onpick(info.created?.index ?? 0)}>
          {t('info.created', { actor: who(info.created.actor), date: when(info.created.time) })}
        </button>
      {/if}
      <button class="button secondary random" type="button" onclick={random}>
        <Icon name="shuffle" size={16} />
        {t('info.random')}
      </button>
    </section>

    {#if onadd}
      <section>
        <button class="button secondary random" type="button" disabled={adding} onclick={() => picker?.click()}>
          <Icon name="upload" size={16} />
          {adding ? t('info.adding') : t('info.addExport')}
        </button>
        <p class="sub">{t('info.addExportHint')}</p>
        <input
          class="visually-hidden"
          type="file"
          accept=".zip,.txt,application/zip,text/plain"
          multiple
          bind:this={picker}
          onchange={picked}
          tabindex="-1"
          aria-label={t('info.addExport')}
        />
      </section>
    {/if}

    {#if past.length}
      <section>
        <h3>{t('info.onThisDay')}</h3>
        <ul class="plain">
          {#each past as p (p.day)}
            <li>
              <button type="button" class="row" onclick={() => onpick(p.index)}>
                <span>{t('info.yearsAgo', { count: p.years })}</span>
                <span class="count">{formatDay(p.day, locale())} · {t('chat.messages', { count: p.count })}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if info.renames.length}
      <section>
        <h3>{t('info.names')}</h3>
        <ul class="plain">
          {#each info.renames as r (r.index)}
            <li>
              <button type="button" class="row" onclick={() => onpick(r.index)}>
                <span>{r.previous ? `“${r.previous}” → “${r.value}”` : `“${r.value}”`}</span>
                <span class="count">{t('info.renamedBy', { date: when(r.time), actor: who(r.actor) })}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section>
      <h3><Icon name="users" size={16} /> {t('info.members')}</h3>
      <p class="sub">{t('info.inGroup', { count: inGroup.length })}</p>
      <ul class="members">
        {#each inGroup as m (m.name)}{@render member(m)}{/each}
      </ul>
      {#if left.length}
        <p class="sub">{t('info.left', { count: left.length })}</p>
        <ul class="members gone">
          {#each left as m (m.name)}{@render member(m)}{/each}
        </ul>
      {/if}
    </section>
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
    justify-content: space-between;
    padding: 8px 10px 8px 16px;
    border-bottom: 1px solid var(--panel-border);
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1rem;
  }

  .body {
    flex: 1;
    overflow-y: auto;
  }

  section {
    display: grid;
    gap: 6px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--panel-border);
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 0.95rem;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 0.88rem;
    text-align: start;
    cursor: pointer;
  }

  .link:hover {
    text-decoration: underline;
  }

  .random {
    justify-self: start;
    min-height: 34px;
    padding: 4px 12px;
    font-size: 0.85rem;
  }

  .plain,
  .members {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row,
  .members button,
  .static {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 4px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    text-align: start;
  }

  .row {
    justify-content: space-between;
    flex-wrap: wrap;
    cursor: pointer;
  }

  .members button {
    cursor: pointer;
  }

  .row:hover,
  .members button:hover {
    background: color-mix(in srgb, var(--text) 6%, transparent);
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
  }

  .static .dot {
    color: var(--muted);
  }

  .name {
    flex: 1;
    min-width: 0;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count,
  .sub {
    color: var(--muted);
    font-size: 0.8rem;
  }

  .sub {
    margin: 6px 0 0;
  }

  .gone .name {
    color: var(--muted);
  }
</style>
