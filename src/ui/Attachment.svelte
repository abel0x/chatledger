<script lang="ts">
  import { mimeTypeFor, type MediaHint } from '../core';
  import { t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import { useChatActions } from './context';
  import Icon from './Icon.svelte';
  import { visible } from './visible';

  let {
    file,
    media = 'unknown',
    index,
    session,
  }: { file: string; media?: MediaHint; index: number; session: Session } = $props();

  const actions = useChatActions();

  let url = $state<string | null>(null);
  let broken = $state(false);

  const available = $derived(session.has(file));
  const mime = $derived(mimeTypeFor(file));
  const shown = $derived.by(() => {
    if (broken) return 'file';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'file';
  });

  function load() {
    if (shown === 'image' && media !== 'sticker') {
      // Bubbles show a downscaled copy; the viewer opens the original.
      void session.thumb(file).then(async th => (url = th?.url ?? (await session.url(file))));
    } else {
      void session.url(file).then(u => (url = u));
    }
  }
</script>

{#if !available}
  <div class="file missing">
    <Icon name="file" />
    <span class="name">{file}</span>
    <small>{t('msg.fileMissing')}</small>
  </div>
{:else if shown === 'image'}
  {#if media === 'sticker'}
    <div class="frame sticker" use:visible={load}>
      {#if url}<img src={url} alt={t('media.sticker')} onerror={() => (broken = true)} />{/if}
    </div>
  {:else}
    <button
      class="frame"
      type="button"
      use:visible={load}
      onclick={() => actions?.openMedia(index)}
      aria-label={t('msg.view', { what: t(`media.${media}`) })}
    >
      {#if url}<img src={url} alt="" onerror={() => (broken = true)} />{/if}
    </button>
  {/if}
{:else if shown === 'video'}
  <div class="frame video" use:visible={load}>
    {#if url}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video src={url} controls preload="metadata" loop={media === 'gif'} onerror={() => (broken = true)}></video>
    {/if}
  </div>
{:else if shown === 'audio'}
  <div class="audio" use:visible={load}>
    {#if url}
      <audio src={url} controls preload="metadata" onerror={() => (broken = true)}></audio>
    {/if}
  </div>
{:else}
  <div class="file" use:visible={load}>
    <Icon name="file" />
    <span class="name">{file}</span>
    {#if url}<a href={url} download={file}>{t('msg.download')}</a>{/if}
  </div>
{/if}

<style>
  .frame {
    padding: 0;
    border: 0;
    display: grid;
    place-items: center;
    width: min(330px, 100%);
    min-height: 180px;
    margin: 2px 0 4px;
    border-radius: 6px;
    overflow: hidden;
    background: color-mix(in srgb, var(--text) 6%, transparent);
  }

  button.frame {
    cursor: zoom-in;
  }

  .frame img,
  .frame video {
    display: block;
    max-width: 100%;
    max-height: 420px;
    object-fit: contain;
  }

  button.frame img {
    width: 100%;
    object-fit: cover;
  }

  .sticker {
    width: 160px;
    min-height: 160px;
    background: transparent;
  }

  .sticker img {
    width: 160px;
    height: 160px;
  }

  .audio {
    min-height: 54px;
    min-width: min(280px, 100%);
    margin: 2px 0;
  }

  .audio audio {
    width: min(300px, 100%);
  }

  .file {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 330px;
    padding: 10px 12px;
    margin: 2px 0 4px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--text) 6%, transparent);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .missing {
    color: var(--muted);
  }

  .missing small {
    flex: none;
  }
</style>
