<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, t } from '../i18n/index.svelte';
  import { appearance } from './appearance.svelte';
  import { formatDay } from './format';

  interface Props {
    /** Days that have messages, oldest first, with their message counts. */
    days: { day: number; count: number }[];
    current: number;
    onjump: (day: number) => void;
  }

  let { days, current, onjump }: Props = $props();

  const PAD = 12;
  let canvas = $state<HTMLCanvasElement>();
  let rail = $state<HTMLDivElement>();
  let width = $state(0);
  let height = $state(0);
  let dragging = false;
  let pending: number | null = null;

  const first = $derived(days[0]?.day ?? 0);
  const last = $derived(days[days.length - 1]?.day ?? 0);
  const span = $derived(Math.max(1, last - first + 1));
  const most = $derived(Math.max(1, ...days.map(d => d.count)));

  const yOf = (day: number) => PAD + ((day - first) / span) * (height - 2 * PAD);

  /** The active day nearest to a point on the rail. */
  function dayAt(y: number): number {
    const raw = first + ((y - PAD) / Math.max(1, height - 2 * PAD)) * span;
    let lo = 0;
    let hi = days.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((days[mid]?.day ?? 0) < raw) lo = mid + 1;
      else hi = mid;
    }
    const after = days[lo]?.day ?? first;
    const before = days[lo - 1]?.day ?? after;
    return Math.abs(before - raw) <= Math.abs(after - raw) ? before : after;
  }

  function draw() {
    if (!canvas || !width || !height) return;
    void appearance.theme;
    const dpr = Math.min(3, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const css = getComputedStyle(canvas);
    const color = (name: string) => css.getPropertyValue(name).trim();

    const x0 = 6;
    const length = width - x0 - 6;
    const per = (height - 2 * PAD) / span;
    const bar = Math.max(1, per > 3 ? per - 1 : per);
    ctx.fillStyle = color('--viz-bar');
    ctx.globalAlpha = 0.75;
    for (const d of days) {
      ctx.fillRect(x0, yOf(d.day), Math.max(2, (Math.log1p(d.count) / Math.log1p(most)) * length), bar);
    }
    ctx.globalAlpha = 1;

    // Year marks, so a long chat can be read at a glance.
    ctx.fillStyle = color('--muted');
    ctx.font = `600 10px ${color('--font') || 'sans-serif'}`;
    let lastYear = -1;
    for (const d of days) {
      const year = new Date(d.day * 86400000).getUTCFullYear();
      if (year === lastYear) continue;
      lastYear = year;
      const y = Math.max(PAD, Math.min(height - 4, yOf(d.day)));
      ctx.fillText(String(year).slice(-2), 2, y - 2);
    }

    ctx.fillStyle = color('--accent');
    ctx.fillRect(0, Math.round(yOf(current)) - 1, width, 3);
  }

  $effect(draw);

  function jumpTo(day: number) {
    pending = day;
    requestAnimationFrame(() => {
      if (pending != null) onjump(pending);
      pending = null;
    });
  }

  function pointer(e: PointerEvent) {
    if (!rail) return;
    const r = rail.getBoundingClientRect();
    jumpTo(dayAt(e.clientY - r.top));
  }

  function keydown(e: KeyboardEvent) {
    const at = days.findIndex(d => d.day >= current);
    let next = at < 0 ? days.length - 1 : at;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next++;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next--;
    else if (e.key === 'PageDown') next = days.findIndex(d => d.day >= current + 30);
    else if (e.key === 'PageUp') next = Math.max(0, days.findLastIndex(d => d.day <= current - 30));
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = days.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (next < 0) next = days.length - 1;
    const day = days[Math.max(0, Math.min(days.length - 1, next))]?.day;
    if (day != null) onjump(day);
  }

  onMount(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', draw);
    return () => media.removeEventListener('change', draw);
  });
</script>

<div
  class="rail"
  bind:this={rail}
  bind:clientWidth={width}
  bind:clientHeight={height}
  role="slider"
  tabindex="0"
  aria-label={t('rail.label')}
  aria-orientation="vertical"
  aria-valuemin={first}
  aria-valuemax={last}
  aria-valuenow={current}
  aria-valuetext={formatDay(current, locale())}
  title={formatDay(current, locale())}
  onpointerdown={e => {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointer(e);
  }}
  onpointermove={e => dragging && pointer(e)}
  onpointerup={() => (dragging = false)}
  onpointercancel={() => (dragging = false)}
  onkeydown={keydown}
>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
  .rail {
    position: relative;
    flex: none;
    width: 44px;
    height: 100%;
    border-inline-start: 1px solid var(--panel-border);
    background: color-mix(in srgb, var(--panel) 60%, transparent);
    cursor: ns-resize;
    touch-action: none;
    user-select: none;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  @media (max-width: 600px) {
    .rail {
      display: none;
    }
  }
</style>
