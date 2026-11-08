<script lang="ts">
  import { chatStats, type Chat } from '../core';
  import { locale, t } from '../i18n/index.svelte';
  import { formatDay, formatDayRange, formatMonth, formatMonthShort } from './format';
  import { readSetting, writeSetting } from './settings';

  let { chat, onshow }: { chat: Chat; onshow?: (messageIndex: number) => void } = $props();

  const stats = $derived(chatStats(chat));
  const TOP = 10;

  let showAll = $state(false);
  let tables = $state(readSetting('statsTables') === 'yes');
  let tip = $state<{ x: number; y: number; value: string; label: string } | null>(null);

  const num = (n: number) => new Intl.NumberFormat(locale()).format(n);
  const percent = (n: number) => new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 1 }).format(n);

  const people = $derived(showAll ? stats.people : stats.people.slice(0, TOP));
  const maxPerson = $derived(Math.max(1, ...stats.people.map(p => p.messages)));
  const maxMonth = $derived(Math.max(1, ...stats.months.map(m => m.count)));
  const maxHeat = $derived(Math.max(1, ...stats.heat));
  const busiestMonth = $derived(stats.months.reduce((best, m) => (m.count > best.count ? m : best), stats.months[0] ?? { month: 0, count: 0 }));

  const weekdays = $derived(
    Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + i)),
    ),
  );
  const weekdaysLong = $derived(
    Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale(), { weekday: 'long', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + i)),
    ),
  );
  const hourLabel = (h: number) => new Intl.DateTimeFormat(locale(), { hour: 'numeric', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1, h));
  const hourRange = (h: number) => {
    const f = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    return f.formatRange(Date.UTC(2024, 0, 1, h), Date.UTC(2024, 0, 1, h, 59));
  };

  /** Five steps of one hue, empty cells kept apart from small counts. */
  function heatLevel(count: number): number {
    if (!count) return 0;
    return Math.min(5, 1 + Math.floor((count / maxHeat) * 5 - 1e-9));
  }

  function show(e: PointerEvent | FocusEvent, value: string, label: string) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Next to the pointer on wide marks, centred on small ones.
    const x = 'clientX' in e && r.width > 60 ? e.clientX : r.left + r.width / 2;
    tip = { x, y: r.top, value, label };
  }

  function hide() {
    tip = null;
  }

  function duration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const parts = [];
    if (days) parts.push(t('stats.days', { count: days }));
    if (hours || !days) parts.push(t('stats.hours', { count: hours }));
    return parts.join(', ');
  }

  const nightOwl = $derived(stats.people.reduce<(typeof stats.people)[number] | null>((best, p) => (p.night > (best?.night ?? 0) ? p : best), null));
  const stickerFan = $derived(stats.people.reduce<(typeof stats.people)[number] | null>((best, p) => (p.stickers > (best?.stickers ?? 0) ? p : best), null));
  const longestBy = $derived(stats.longest ? chat.messages[stats.longest.index]?.sender : null);
  const mediaKing = $derived(stats.people.reduce<(typeof stats.people)[number] | null>((best, p) => (p.media > (best?.media ?? 0) ? p : best), null));

  function setTables(value: boolean) {
    tables = value;
    writeSetting('statsTables', value ? 'yes' : null);
  }
</script>

<div class="stats" onscroll={hide}>
  <div class="column">
    {#if !stats.messages}
      <p class="empty">{t('stats.none')}</p>
    {:else}
      <p class="period">{formatDayRange(stats.first, stats.last, locale())}</p>

      <section class="tiles" aria-label={t('chat.stats')}>
        <div class="tile">
          <span class="label">{t('stats.messages')}</span>
          <span class="value">{num(stats.messages)}</span>
        </div>
        <div class="tile">
          <span class="label">{t('stats.people')}</span>
          <span class="value">{num(stats.people.length)}</span>
        </div>
        <div class="tile">
          <span class="label">{t('stats.activeDays')}</span>
          <span class="value">{t('stats.activeDaysValue', { active: num(stats.activeDays), span: num(stats.spanDays) })}</span>
        </div>
        <div class="tile">
          <span class="label">{t('stats.media')}</span>
          <span class="value">{num(stats.media)}</span>
        </div>
      </section>

      <label class="toggle">
        <input type="checkbox" checked={tables} onchange={e => setTables(e.currentTarget.checked)} />
        {t('stats.tables')}
      </label>

      <section class="card">
        <h2>{t('stats.who')}</h2>
        {#if tables}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('stats.colPerson')}</th>
                  <th scope="col" class="n">{t('stats.messages')}</th>
                  <th scope="col" class="n">{t('stats.colWords')}</th>
                  <th scope="col" class="n">{t('stats.colMedia')}</th>
                </tr>
              </thead>
              <tbody>
                {#each people as p (p.person)}
                  <tr>
                    <th scope="row">{chat.people[p.person]}</th>
                    <td class="n">{num(p.messages)}</td>
                    <td class="n">{num(p.words)}</td>
                    <td class="n">{num(p.media)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <ol class="bars">
            {#each people as p (p.person)}
              <li
                onpointerenter={e => show(e, t('chat.messages', { count: p.messages }), t('stats.share', { percent: percent(p.messages / stats.messages) }))}
                onpointerleave={hide}
              >
                <span class="name">{chat.people[p.person]}</span>
                <span class="track">
                  <span class="bar" style:width={`${(p.messages / maxPerson) * 100}%`}></span>
                  <span class="tip-value">{num(p.messages)}</span>
                </span>
              </li>
            {/each}
          </ol>
        {/if}
        {#if stats.people.length > TOP}
          <button class="more" type="button" onclick={() => (showAll = !showAll)}>
            {showAll ? t('stats.showFewer') : t('stats.showAll', { count: stats.people.length })}
          </button>
        {/if}
      </section>

      <section class="card">
        <h2>{t('stats.when')}</h2>
        {#if tables}
          <div class="table-wrap">
            <table class="dense">
              <thead>
                <tr>
                  <th scope="col">{t('stats.colDay')}</th>
                  {#each { length: 24 } as _, h (h)}<th scope="col" class="n">{hourLabel(h)}</th>{/each}
                </tr>
              </thead>
              <tbody>
                {#each weekdays as day, w (w)}
                  <tr>
                    <th scope="row">{day}</th>
                    {#each { length: 24 } as _, h (h)}<td class="n">{num(stats.heat[w * 24 + h] ?? 0)}</td>{/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="heat" role="img" aria-label={t('stats.when')}>
            <span></span>
            {#each { length: 24 } as _, h (h)}
              <span class="hour">{h % 3 === 0 ? hourLabel(h) : ''}</span>
            {/each}
            {#each weekdays as day, w (w)}
              <span class="weekday">{day}</span>
              {#each { length: 24 } as _, h (h)}
                {@const count = stats.heat[w * 24 + h] ?? 0}
                <span
                  role="presentation"
                  class={`cell h${heatLevel(count)}`}
                  onpointerenter={e => show(e, t('chat.messages', { count }), `${weekdaysLong[w]} ${hourRange(h)}`)}
                  onpointerleave={hide}
                ></span>
              {/each}
            {/each}
          </div>
          <div class="legend" aria-hidden="true">
            <span>{t('stats.fewer')}</span>
            {#each [0, 1, 2, 3, 4, 5] as level (level)}<span class={`cell h${level}`}></span>{/each}
            <span>{t('stats.more')}</span>
          </div>
        {/if}
      </section>

      <section class="card">
        <h2>{t('stats.perMonth')}</h2>
        {#if tables}
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">{t('stats.colMonth')}</th><th scope="col" class="n">{t('stats.messages')}</th></tr>
              </thead>
              <tbody>
                {#each stats.months as m (m.month)}
                  <tr><th scope="row">{formatMonth(m.month, locale())}</th><td class="n">{num(m.count)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="columns" role="img" aria-label={t('stats.perMonth')}>
            {#each stats.months as m (m.month)}
              <div
                class="slot"
                onpointerenter={e => show(e, t('chat.messages', { count: m.count }), formatMonth(m.month, locale()))}
                onpointerleave={hide}
                role="presentation"
              >
                {#if m === busiestMonth}<span class="cap">{num(m.count)}</span>{/if}
                <span class="col" style:height={`${(m.count / maxMonth) * 100}%`}></span>
              </div>
            {/each}
          </div>
          <div class="months" aria-hidden="true">
            {#each stats.months as m, i (m.month)}
              <span>
                {#if i === 0 || m.month % 12 === 0}{formatMonthShort(m.month, locale(), true)}{:else if stats.months.length <= 12 || m.month % 3 === 0}{formatMonthShort(m.month, locale(), false)}{/if}
              </span>
            {/each}
          </div>
        {/if}
      </section>

      {#if stats.emojis.length}
        <section class="card">
          <h2>{t('stats.emojis')}</h2>
          <ol class="emojis">
            {#each stats.emojis as e (e.emoji)}
              <li><span class="emoji">{e.emoji}</span><span class="count">{num(e.count)}</span></li>
            {/each}
          </ol>
        </section>
      {/if}

      <section class="card">
        <h2>{t('stats.highlights')}</h2>
        <div class="tiles inner">
          {#if stats.busiestDay}
            <div class="tile">
              <span class="label">{t('stats.busiestDay')}</span>
              <span class="value small">{formatDay(stats.busiestDay.day, locale())}</span>
              <span class="sub">{t('chat.messages', { count: stats.busiestDay.count })}</span>
            </div>
          {/if}
          {#if stats.longestStreak}
            <div class="tile">
              <span class="label">{t('stats.streak')}</span>
              <span class="value small">{t('stats.days', { count: stats.longestStreak.days })}</span>
              <span class="sub">{t('stats.since', { date: formatDay(stats.longestStreak.start, locale()) })}</span>
            </div>
          {/if}
          {#if stats.longestSilence}
            <div class="tile">
              <span class="label">{t('stats.silence')}</span>
              <span class="value small">{duration(stats.longestSilence.to - stats.longestSilence.from)}</span>
              <span class="sub">{formatDayRange(stats.longestSilence.from, stats.longestSilence.to, locale())}</span>
            </div>
          {/if}
          {#if nightOwl}
            <div class="tile">
              <span class="label">{t('stats.nightOwl')}</span>
              <span class="value small">{chat.people[nightOwl.person]}</span>
              <span class="sub">{t('stats.nightOwlValue', { count: nightOwl.night })}</span>
            </div>
          {/if}
          {#if stats.activeDays}
            <div class="tile">
              <span class="label">{t('stats.average')}</span>
              <span class="value small">{new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(stats.messages / stats.activeDays)}</span>
            </div>
          {/if}
          {#if stats.longest}
            <div class="tile">
              <span class="label">{t('stats.longest')}</span>
              <span class="value small">{longestBy != null ? chat.people[longestBy] : ''}</span>
              <span class="sub">
                {t('stats.characters', { count: stats.longest.length })}
                {#if onshow}· <button class="more inline" type="button" onclick={() => onshow?.(stats.longest?.index ?? 0)}>{t('stats.show')}</button>{/if}
              </span>
            </div>
          {/if}
          {#if stickerFan}
            <div class="tile">
              <span class="label">{t('stats.stickers')}</span>
              <span class="value small">{chat.people[stickerFan.person]}</span>
              <span class="sub">{num(stickerFan.stickers)}</span>
            </div>
          {/if}
          {#if mediaKing}
            <div class="tile">
              <span class="label">{t('stats.mostMedia')}</span>
              <span class="value small">{chat.people[mediaKing.person]}</span>
              <span class="sub">{num(mediaKing.media)}</span>
            </div>
          {/if}
        </div>
      </section>
    {/if}
  </div>

  {#if tip}
    <div class="tooltip" role="tooltip" style:left={`${tip.x}px`} style:top={`${tip.y}px`}>
      <strong>{tip.value}</strong>
      <span>{tip.label}</span>
    </div>
  {/if}
</div>

<style>
  .stats {
    height: 100%;
    overflow-y: auto;
    background: var(--bg);
  }

  .column {
    max-width: 920px;
    margin: 0 auto;
    padding: 16px 16px 32px;
  }

  .period,
  .empty {
    margin: 0 0 12px;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }

  .tile {
    display: grid;
    align-content: start;
    gap: 2px;
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--bubble-in);
    box-shadow: var(--shadow);
  }

  .inner .tile {
    box-shadow: none;
    border: 1px solid var(--panel-border);
  }

  .label,
  .sub {
    color: var(--muted);
    font-size: 0.82rem;
  }

  .value {
    font-size: 1.6rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .value.small {
    font-size: 1.1rem;
    overflow-wrap: anywhere;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 0;
    color: var(--muted);
    font-size: 0.88rem;
    cursor: pointer;
  }

  .toggle input {
    accent-color: var(--accent);
  }

  .card {
    margin-top: 14px;
    padding: 16px;
    border-radius: 12px;
    background: var(--bubble-in);
    box-shadow: var(--shadow);
  }

  h2 {
    margin: 0 0 12px;
    font-size: 1rem;
    font-weight: 600;
  }

  .bars {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .bars li {
    display: grid;
    grid-template-columns: minmax(90px, 32%) 1fr;
    align-items: center;
    gap: 10px;
    padding: 2px 0;
  }

  .bars .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.9rem;
  }

  .track {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .bar {
    flex: none;
    max-width: calc(100% - 4.5em);
    height: 14px;
    border-radius: 0 4px 4px 0;
    background: var(--viz-bar);
  }

  .bars li:hover .bar {
    filter: brightness(1.12);
  }

  .tip-value {
    flex: none;
    color: var(--muted);
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
  }

  .more.inline {
    margin: 0;
    padding: 0;
  }

  .more {
    margin-top: 10px;
    padding: 6px 0;
    border: 0;
    background: transparent;
    color: var(--link);
    cursor: pointer;
  }

  .heat {
    display: grid;
    grid-template-columns: auto repeat(24, minmax(0, 1fr));
    gap: 2px;
    align-items: center;
  }

  .hour {
    color: var(--muted);
    font-size: 0.68rem;
    white-space: nowrap;
  }

  .weekday {
    padding-inline-end: 6px;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .cell {
    display: block;
    aspect-ratio: 1;
    min-height: 10px;
    border-radius: 2px;
    background: var(--heat-0);
  }

  .heat .cell:hover {
    outline: 2px solid var(--text);
    outline-offset: -1px;
  }

  .h1 { background: var(--heat-1); }
  .h2 { background: var(--heat-2); }
  .h3 { background: var(--heat-3); }
  .h4 { background: var(--heat-4); }
  .h5 { background: var(--heat-5); }

  .legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
    margin-top: 10px;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .legend .cell {
    width: 12px;
    min-height: 12px;
  }

  .legend span:first-child {
    margin-inline-end: 4px;
  }

  .legend span:last-child {
    margin-inline-start: 4px;
  }

  .columns {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 160px;
    border-bottom: 1px solid var(--grid);
  }

  .slot {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: 100%;
  }

  .col {
    width: 100%;
    max-width: 24px;
    border-radius: 4px 4px 0 0;
    background: var(--viz-bar);
  }

  .slot:hover .col {
    filter: brightness(1.12);
  }

  .cap {
    margin-bottom: 2px;
    color: var(--text);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .months {
    display: flex;
    gap: 2px;
    margin-top: 4px;
  }

  .months span {
    flex: 1;
    overflow: visible;
    color: var(--muted);
    font-size: 0.68rem;
    white-space: nowrap;
  }

  .emojis {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .emojis li {
    display: grid;
    justify-items: center;
    padding: 8px 4px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--text) 5%, transparent);
  }

  .emoji {
    font-size: 1.6rem;
    line-height: 1.2;
  }

  .count {
    color: var(--muted);
    font-size: 0.8rem;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }

  th,
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--grid);
    text-align: start;
  }

  thead th {
    color: var(--muted);
    font-weight: 600;
  }

  tbody th {
    font-weight: 500;
  }

  .n {
    text-align: end;
    font-variant-numeric: tabular-nums;
  }

  .dense th,
  .dense td {
    padding: 4px;
    font-size: 0.78rem;
  }

  .tooltip {
    position: fixed;
    z-index: 30;
    display: grid;
    gap: 1px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--text);
    color: var(--bg);
    font-size: 0.8rem;
    pointer-events: none;
    transform: translate(-50%, calc(-100% - 8px));
    white-space: nowrap;
  }

  .tooltip strong {
    font-size: 0.9rem;
  }
</style>
