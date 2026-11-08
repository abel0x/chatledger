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
    left: 'M15 5l-7 7 7 7',
    right: 'M9 5l7 7-7 7',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    play: 'M8 5v14l11-7z',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    chat: 'M4 5h16v11H9l-5 4z',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    chart: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
    chevron: 'M6 9l6 6 6-6',
    star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
    settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.01',
    copy: 'M9 9h11v11H9zM5 15V4h11',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    shuffle: 'M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M18 4l3 3-3 3M18 14l3 3-3 3',
    keyboard: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8',
    pause: 'M8 5v14M16 5v14',
    dots: 'M12 5v.01M12 12v.01M12 19v.01',
    users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M17 14a6 6 0 0 1 4 6',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>
