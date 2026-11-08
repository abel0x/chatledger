<script lang="ts" module>
  import type { IconName } from './Icon.svelte';

  export interface MenuItem {
    label: string;
    icon: IconName;
    run: () => void;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';

  let { items, anchor, label, onclose }: { items: MenuItem[]; anchor: HTMLElement; label: string; onclose: () => void } = $props();

  let menu = $state<HTMLDivElement>();
  let top = $state(0);
  let left = $state(0);

  function place() {
    if (!menu) return;
    const a = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    top = a.bottom + 4 + m.height > innerHeight - 8 ? Math.max(8, a.top - 4 - m.height) : a.bottom + 4;
    left = Math.min(Math.max(8, a.right - m.width), innerWidth - m.width - 8);
  }

  function buttons(): HTMLButtonElement[] {
    return menu ? [...menu.querySelectorAll<HTMLButtonElement>('button')] : [];
  }

  function keydown(e: KeyboardEvent) {
    const list = buttons();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      onclose();
      anchor.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      list[e.key === 'Home' ? 0 : list.length - 1]?.focus();
    }
  }

  function outside(e: PointerEvent) {
    if (!menu?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onclose();
  }

  onMount(() => {
    anchor.setAttribute('aria-expanded', 'true');
    place();
    buttons()[0]?.focus();
    return () => anchor.setAttribute('aria-expanded', 'false');
  });
</script>

<svelte:window onpointerdown={outside} onresize={onclose} onscrollcapture={onclose} />

<div class="menu" role="menu" aria-label={label} tabindex="-1" bind:this={menu} style:top={`${top}px`} style:left={`${left}px`} onkeydown={keydown}>
  {#each items as item (item.label)}
    <button
      type="button"
      role="menuitem"
      tabindex="-1"
      onclick={() => {
        onclose();
        item.run();
      }}
    >
      <Icon name={item.icon} size={18} />
      {item.label}
    </button>
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    z-index: 30;
    display: grid;
    min-width: 200px;
    padding: 6px 0;
    border-radius: 10px;
    background: var(--panel);
    box-shadow: 0 4px 16px #0b141a40;
  }

  button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 16px;
    border: 0;
    background: transparent;
    text-align: start;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    background: color-mix(in srgb, var(--text) 8%, transparent);
    outline: none;
  }
</style>
