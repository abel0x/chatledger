<script lang="ts">
  import { onMount } from 'svelte';
  import { safeFileName, type Chat } from '../core';
  import { locale, t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import { formatFull } from './format';
  import Icon from './Icon.svelte';
  import type { Visual } from './media';

  interface Props {
    items: Visual[];
    start: number;
    chat: Chat;
    session: Session;
    onclose: () => void;
    onshow: (messageIndex: number) => void;
  }

  let { items, start, chat, session, onclose, onshow }: Props = $props();

  let pos = $state(0);
  let url = $state<string | null>(null);
  let closeButton = $state<HTMLButtonElement>();
  let downX: number | null = null;

  $effect.pre(() => {
    pos = Math.max(0, Math.min(items.length - 1, start));
  });

  const item = $derived(items[pos]);
  const message = $derived(item ? chat.messages[item.index] : undefined);
  const sender = $derived(message?.sender != null ? chat.people[message.sender] : null);

  let tooLarge = $state(false);

  $effect(() => {
    const current = item;
    url = null;
    tooLarge = false;
    if (!current) return;
    let live = true;
    void (async () => {
      if (current.kind === 'image') {
        // A picture claiming too many pixels is never decoded; it can still be saved.
        const th = await session.thumb(current.file);
        if (!live) return;
        if (th?.tooLarge) tooLarge = true;
        else if (th?.url) url = th.url;
      }
      const full = await session.url(current.file);
      if (live && full) url = full;
    })();
    // Have the neighbours ready before they are asked for.
    for (const near of [items[pos - 1], items[pos + 1]]) if (near) void session.url(near.file);
    return () => {
      live = false;
    };
  });

  function go(step: number) {
    const next = pos + step;
    if (next >= 0 && next < items.length) pos = next;
  }

  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onclose();
    } else if (e.key === 'ArrowLeft') go(document.dir === 'rtl' ? 1 : -1);
    else if (e.key === 'ArrowRight') go(document.dir === 'rtl' ? -1 : 1);
  }

  function pointerdown(e: PointerEvent) {
    downX = e.pointerType === 'mouse' ? null : e.clientX;
  }

  function pointerup(e: PointerEvent) {
    if (downX == null) return;
    const dx = e.clientX - downX;
    downX = null;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  }

  onMount(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton?.focus();
    return () => before?.focus?.();
  });
</script>

<svelte:window onkeydown={keydown} />

<div class="viewer" role="dialog" aria-modal="true" aria-label={t('viewer.label')}>
  <header>
    <div class="who">
      {#if sender}<strong>{sender}</strong>{/if}
      {#if message}<span>{formatFull(message.time, locale())}</span>{/if}
    </div>
    <span class="pos">{t('viewer.position', { index: pos + 1, count: items.length })}</span>
    {#if item}
      <button class="tool" type="button" onclick={() => onshow(item.index)} title={t('gallery.showInChat')} aria-label={t('gallery.showInChat')}>
        <Icon name="chat" />
      </button>
      {#if url}
        <a class="tool" href={url} download={safeFileName(item.file)} title={t('msg.download')} aria-label={t('msg.download')}>
          <Icon name="download" />
        </a>
      {/if}
    {/if}
    <button class="tool" type="button" bind:this={closeButton} onclick={onclose} title={t('viewer.close')} aria-label={t('viewer.close')}>
      <Icon name="close" />
    </button>
  </header>

  <div class="stage" onpointerdown={pointerdown} onpointerup={pointerup} role="presentation">
    <div class="box">
      {#if tooLarge}
        <p class="big">{t('file.tooLarge')}</p>
      {:else if url && item}
        {#if item.kind === 'image'}
          <img src={url} alt={message?.text ?? t('media.image')} draggable="false" />
        {:else}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={url} controls autoplay playsinline></video>
        {/if}
      {:else}
        <div class="spinner" aria-hidden="true"></div>
      {/if}
    </div>
    {#if pos > 0}
      <button class="nav prev" type="button" onclick={() => go(-1)} aria-label={t('viewer.prev')} title={t('viewer.prev')}>
        <Icon name="left" size={28} />
      </button>
    {/if}
    {#if pos < items.length - 1}
      <button class="nav next" type="button" onclick={() => go(1)} aria-label={t('viewer.next')} title={t('viewer.next')}>
        <Icon name="right" size={28} />
      </button>
    {/if}
  </div>

  {#if message?.text}
    <p class="caption">{message.text}</p>
  {/if}
</div>

<style>
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    background: #0b141af2;
    color: #e9edef;
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 8px 16px;
  }

  .who {
    flex: 1;
    min-width: 0;
    display: grid;
    font-size: 0.9rem;
  }

  .who span,
  .pos {
    color: #aebac1;
    font-size: 0.8rem;
  }

  .pos {
    white-space: nowrap;
  }

  .tool {
    display: inline-grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .tool:hover {
    background: #ffffff1a;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    touch-action: pan-y pinch-zoom;
  }

  .box {
    position: absolute;
    inset: 8px 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  img,
  video {
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: contain;
    user-select: none;
  }

  .nav {
    position: absolute;
    top: 50%;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 50%;
    background: #ffffff1f;
    color: inherit;
    cursor: pointer;
    transform: translateY(-50%);
  }

  .nav:hover {
    background: #ffffff33;
  }

  .prev {
    left: 8px;
  }

  .next {
    right: 8px;
  }

  .caption {
    max-height: 30vh;
    margin: 0;
    padding: 10px 16px 16px;
    overflow-y: auto;
    text-align: center;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .big {
    color: #aebac1;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #ffffff33;
    border-top-color: #e9edef;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 600px) {
    .box {
      inset: 8px 0;
    }

    .nav {
      width: 40px;
      height: 40px;
    }
  }
</style>
