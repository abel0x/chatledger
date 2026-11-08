<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import type { Session } from '../loader/client';
  import { visible } from './visible';

  let { file, session, onclick }: { file: string; session: Session; onclick: () => void } = $props();
  let src = $state<string | null>(null);
</script>

<button class="sticker" type="button" use:visible={() => void session.url(file).then(u => (src = u))} {onclick} title={t('gallery.showInChat')}>
  {#if src}<img {src} alt={t('media.sticker')} loading="lazy" decoding="async" />{/if}
</button>

<style>
  .sticker {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    width: 100%;
    padding: 6px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
  }

  .sticker:hover {
    background: color-mix(in srgb, var(--text) 6%, transparent);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
