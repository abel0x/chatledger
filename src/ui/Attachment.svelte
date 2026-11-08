<script lang="ts">
  import { mimeTypeFor, type MediaHint } from '../core';
  import { t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import Icon from './Icon.svelte';
  import { visible } from './visible';

  let { file, media = 'unknown', session }: { file: string; media?: MediaHint; session: Session } = $props();

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
    void session.url(file).then(u => (url = u));
  }
</script>

{#if !available}
  <div class="file missing">
    <Icon name="file" />
    <span class="name">{file}</span>
    <small>{t('msg.fileMissing')}</small>
  </div>
{:else if shown === 'image'}
  <div class="frame" class:sticker={media === 'sticker'} use:visible={load}>
    {#if url}
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={t(`media.${media}`)} onerror={() => (broken = true)} />
      </a>
    {/if}
  </div>
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
    display: grid;
    place-items: center;
    width: min(330px, 100%);
    min-height: 180px;
    margin: 2px 0 4px;
    border-radius: 6px;
    overflow: hidden;
    background: color-mix(in srgb, var(--text) 6%, transparent);
  }

  .frame a {
    display: block;
    line-height: 0;
  }

  .frame img,
  .frame video {
    display: block;
    max-width: 100%;
    max-height: 420px;
    object-fit: contain;
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
