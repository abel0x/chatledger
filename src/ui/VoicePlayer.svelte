<script lang="ts" module>
  import { readSetting, writeSetting } from './settings';

  const SPEEDS = [1, 1.5, 2];
  let playing: HTMLAudioElement | null = null;
  let speed = $state(Number(readSetting('voiceSpeed')) || 1);

  /** Only one recording plays at a time, as on a phone. */
  function claim(audio: HTMLAudioElement) {
    if (playing && playing !== audio) playing.pause();
    playing = audio;
  }

  function nextSpeed() {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    writeSetting('voiceSpeed', speed === 1 ? null : String(speed));
  }
</script>

<script lang="ts">
  import { locale, t } from '../i18n/index.svelte';
  import Icon from './Icon.svelte';
  import { waveform } from './waveform';

  let {
    src,
    voice = true,
    load,
    onerror,
  }: { src: string; voice?: boolean; load?: () => Promise<Blob | null>; onerror?: () => void } = $props();

  let bars = $state.raw<number[] | null>(null);

  $effect(() => {
    if (!load) return;
    let live = true;
    void load()
      .then(blob => (blob ? waveform(blob) : null))
      .then(peaks => {
        if (live) bars = peaks;
      });
    return () => {
      live = false;
    };
  });


  let audio = $state<HTMLAudioElement>();
  let paused = $state(true);
  let time = $state(0);
  let duration = $state(0);
  const played = $derived(duration ? time / duration : 0);

  $effect(() => {
    if (audio) audio.playbackRate = speed;
  });

  function clock(seconds: number): string {
    if (!Number.isFinite(seconds)) return '0:00';
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function toggle() {
    if (!audio) return;
    if (audio.paused) {
      claim(audio);
      void audio.play().catch(() => onerror?.());
    } else audio.pause();
  }

  const speedLabel = $derived(`${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(speed)}×`);
</script>

<div class="player" class:voice>
  <audio bind:this={audio} {src} preload="metadata" bind:paused bind:currentTime={time} bind:duration {onerror}></audio>
  <button class="play" type="button" onclick={toggle} aria-label={paused ? t('voice.play') : t('voice.pause')}>
    <Icon name={paused ? 'play' : 'pause'} size={20} filled={paused} />
  </button>
  <div class="track">
    {#if bars}
      <div class="wave" aria-hidden="true">
        {#each bars as level, i (i)}
          <span class:done={i / bars.length < played} style:height={`${Math.max(12, level * 100)}%`}></span>
        {/each}
      </div>
    {/if}
    <input
      class:over={!!bars}
      type="range"
      min="0"
      max={duration || 0}
      step="0.1"
      bind:value={time}
      aria-label={t('voice.seek')}
      aria-valuetext={`${clock(time)} / ${clock(duration)}`}
    />
    <span class="times">{clock(paused && !time ? duration : time)}</span>
  </div>
  <button class="speed" type="button" onclick={nextSpeed} aria-label={`${t('voice.speed')}: ${speedLabel}`} title={t('voice.speed')}>
    {speedLabel}
  </button>
</div>

<style>
  .player {
    display: flex;
    align-items: center;
    gap: 8px;
    width: min(300px, 100%);
    padding: 4px 0;
  }

  .play {
    display: grid;
    place-items: center;
    flex: none;
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-text);
    cursor: pointer;
  }

  .track {
    position: relative;
    flex: 1;
    min-width: 0;
    display: grid;
  }

  .wave {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 26px;
  }

  .wave span {
    flex: 1;
    min-width: 2px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--muted) 55%, transparent);
  }

  .wave span.done {
    background: var(--accent);
  }

  /* With a waveform, the slider stays for keyboard and screen readers but lies invisibly on top. */
  input.over {
    position: absolute;
    top: 0;
    left: 0;
    height: 26px;
    opacity: 0;
    cursor: pointer;
  }

  input[type='range'] {
    width: 100%;
    margin: 0;
    accent-color: var(--accent);
  }

  .times {
    color: var(--muted);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }

  .speed {
    flex: none;
    min-width: 40px;
    padding: 3px 6px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 10%, transparent);
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }
</style>
