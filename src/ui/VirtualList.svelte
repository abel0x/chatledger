<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte';
  import type { Action } from 'svelte/action';
  import { HeightIndex } from './heights';

  export type Align = 'start' | 'center' | 'end';

  interface Props {
    count: number;
    estimate: (i: number) => number;
    key: (i: number) => string;
    item: Snippet<[number]>;
    label: string;
    /** Pixels drawn beyond the visible area, above and below. */
    overscan?: number;
    onview?: (first: number, atStart: boolean, atEnd: boolean) => void;
  }

  let { count, estimate, key, item, label, overscan = 1200, onview }: Props = $props();

  /** Empty room under the last row, so floating buttons never cover it. */
  const END_SPACE = 88;

  // Built once: the list is remounted for another chat, never resized.
  const heights = untrack(() => new HeightIndex(Array.from({ length: count }, (_, i) => estimate(i))));

  let scroller = $state<HTMLDivElement>();
  let space = $state<HTMLDivElement>();
  let win = $state<HTMLDivElement>();
  let top = $state(0);
  let viewport = $state(0);
  let version = $state(0);

  const range = $derived.by(() => {
    void version;
    const start = heights.indexAt(top - overscan);
    const end = Math.min(count, heights.indexAt(top + viewport + overscan) + 1);
    return { start, end, offset: heights.offsetOf(start), total: heights.total };
  });

  const indices = $derived(Array.from({ length: Math.max(0, range.end - range.start) }, (_, k) => range.start + k));

  let jump: { index: number; align: Align; frames: number } | null = null;

  function targetFor(index: number, align: Align): number {
    const offset = heights.offsetOf(index);
    if (align === 'center') return offset - (viewport - heights.get(index)) / 2;
    if (align === 'end') return offset + heights.get(index) - viewport + END_SPACE;
    return offset - 8;
  }

  /** Writes the spacer sizes straight away so a scroll position set right after is not clamped. */
  function syncSpace() {
    if (space) space.style.height = `${heights.total}px`;
    if (win) win.style.transform = `translateY(${heights.offsetOf(range.start)}px)`;
  }

  function applyJump() {
    if (!scroller || !jump) return;
    syncSpace();
    scroller.scrollTop = targetFor(jump.index, jump.align);
    top = scroller.scrollTop;
  }

  /** Rows near the target get measured over the next frames; keep aiming until they settle. */
  function settle() {
    requestAnimationFrame(() => {
      if (!jump) return;
      applyJump();
      if (++jump.frames < 10) settle();
      else jump = null;
    });
  }

  export function scrollToIndex(index: number, align: Align = 'start') {
    if (!count) return;
    jump = { index: Math.max(0, Math.min(count - 1, index)), align, frames: 0 };
    applyJump();
    settle();
  }

  function cancelJump() {
    jump = null;
  }

  const observer = new ResizeObserver(entries => {
    if (!scroller) return;
    const before = scroller.scrollTop;
    const anchor = heights.indexAt(before);
    const inside = before - heights.offsetOf(anchor);
    let changed = false;
    for (const e of entries) {
      const el = e.target as HTMLElement;
      const h = e.borderBoxSize[0]?.blockSize ?? el.offsetHeight;
      if (h > 0 && heights.set(Number(el.dataset.index), h)) changed = true;
    }
    if (!changed) return;
    if (jump) applyJump();
    else {
      // Keep the row at the top of the screen where it was while rows above it change size.
      syncSpace();
      const want = heights.offsetOf(anchor) + inside;
      if (Math.abs(scroller.scrollTop - want) > 0.5) scroller.scrollTop = want;
      top = scroller.scrollTop;
    }
    version++;
  });

  onDestroy(() => observer.disconnect());

  const measure: Action<HTMLElement> = node => {
    observer.observe(node);
    return { destroy: () => observer.unobserve(node) };
  };

  $effect(() => {
    void version;
    if (!onview) return;
    const first = heights.indexAt(top + 1);
    onview(first, top <= 4, top + viewport >= heights.total + END_SPACE - 8);
  });
</script>

<!-- A scrolling region has to take focus so it can be scrolled from the keyboard. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="vl"
  bind:this={scroller}
  bind:clientHeight={viewport}
  onscroll={() => scroller && (top = scroller.scrollTop)}
  onwheel={cancelJump}
  ontouchstart={cancelJump}
  onkeydown={cancelJump}
  tabindex="0"
  role="region"
  aria-label={label}
>
  <div class="vl-space" bind:this={space} style:height={`${range.total}px`}>
    <div class="vl-window" bind:this={win} style:transform={`translateY(${range.offset}px)`}>
      {#each indices as i (key(i))}
        <div class="vl-item" data-index={i} use:measure>{@render item(i)}</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .vl {
    position: relative;
    height: 100%;
    overflow-y: auto;
    overflow-anchor: none;
    overscroll-behavior: contain;
    outline-offset: -2px;
  }

  .vl::after {
    content: '';
    display: block;
    height: 88px;
  }

  .vl-space {
    position: relative;
  }

  .vl-window {
    position: absolute;
    inset: 0 0 auto;
    max-width: var(--vl-max-width, none);
    margin: 0 auto;
    padding: 0 var(--vl-gutter, 0);
    will-change: transform;
  }

  .vl-item {
    display: flow-root;
  }
</style>
