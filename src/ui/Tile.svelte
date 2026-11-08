<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import Icon from './Icon.svelte';
  import type { Visual } from './media';
  import { visible } from './visible';

  let { visual, session, onclick }: { visual: Visual; session: Session; onclick: () => void } = $props();

  let src = $state<string | null>(null);

  function load() {
    if (visual.kind === 'image') {
      void session.thumb(visual.file).then(async th => (src = th?.url ?? (await session.url(visual.file))));
    } else {
      void session.url(visual.file).then(u => (src = u));
    }
  }
</script>

<button class="tile" type="button" use:visible={load} {onclick} aria-label={t('msg.view', { what: t(`media.${visual.kind === 'image' ? 'image' : 'video'}`) })}>
  {#if src}
    {#if visual.kind === 'image'}
      <img {src} alt="" loading="lazy" decoding="async" />
    {:else}
      <video src={`${src}#t=0.5`} preload="metadata" muted playsinline tabindex="-1"></video>
    {/if}
  {/if}
  {#if visual.kind === 'video'}
    <span class="play"><Icon name="play" size={18} /></span>
  {/if}
</button>

<style>
  .tile {
    position: relative;
    display: block;
    aspect-ratio: 1;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 4px;
    overflow: hidden;
    background: color-mix(in srgb, var(--text) 8%, transparent);
    cursor: pointer;
  }

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .play {
    position: absolute;
    right: 6px;
    bottom: 6px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #0b141aa6;
    color: #fff;
  }
</style>
