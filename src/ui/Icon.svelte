<script lang="ts" module>
  const PATHS = {
    close: 'M6 6l12 12M18 6L6 18',
    file: 'M7 3h7l5 5v13H7zM14 3v5h5',
    folder: 'M3 6h6l2 2h10v11H3z',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    pin: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    blocked: 'M5.6 5.6l12.8 12.8M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    poll: 'M5 20V10M12 20V4M19 20v-7',
    lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    down: 'M12 5v14M6 13l6 6 6-6',
    up: 'M12 19V5M6 11l6-6 6 6',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>
