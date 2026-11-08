<script lang="ts">
  import { locale, t } from '../i18n/index.svelte';
  import type { SavedChat } from '../loader/library';
  import type { LoadErrorCode, Phase } from '../loader/open';
  import { filesFromDrop } from './drop';
  import { formatBytes, formatDayRange } from './format';
  import Icon from './Icon.svelte';
  import LangSwitch from './LangSwitch.svelte';

  interface Props {
    busy: boolean;
    progress: { phase: Phase; fraction: number } | null;
    error: LoadErrorCode | null;
    library: SavedChat[];
    remember: boolean;
    canRemember: boolean;
    onopen: (files: File[]) => void;
    onopensaved: (id: string) => void;
    onremove: (id: string) => void;
    onremember: (value: boolean) => void;
    locked: boolean;
    protectedLibrary: boolean;
    working: boolean;
    onunlock: (password: string) => Promise<boolean>;
    onprotect: (password: string) => Promise<void>;
    onunprotect: () => Promise<void>;
    onlocknow: () => void;
    onforget: () => Promise<void>;
  }

  let {
    busy,
    progress,
    error,
    library,
    remember,
    canRemember,
    onopen,
    onopensaved,
    onremove,
    onremember,
    locked,
    protectedLibrary,
    working,
    onunlock,
    onprotect,
    onunprotect,
    onlocknow,
    onforget,
  }: Props = $props();

  let password = $state('');
  let repeat = $state('');
  let lockError = $state<string | null>(null);

  async function tryUnlock(e: SubmitEvent) {
    e.preventDefault();
    lockError = null;
    if (!(await onunlock(password))) lockError = t('lock.wrong');
    else password = '';
  }

  async function setPassword(e: SubmitEvent) {
    e.preventDefault();
    lockError = null;
    if (password.length < 8) lockError = t('lock.short');
    else if (password !== repeat) lockError = t('lock.mismatch');
    else {
      await onprotect(password);
      password = '';
      repeat = '';
    }
  }

  function forgot() {
    if (confirm(t('lock.forgotConfirm'))) void onforget();
  }

  let dragging = $state(false);
  let confirming = $state<string | null>(null);
  let depth = 0;

  function picked(e: Event & { currentTarget: HTMLInputElement }) {
    const files = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = '';
    if (files.length) onopen(files);
  }

  function enter(e: DragEvent) {
    e.preventDefault();
    depth++;
    dragging = true;
  }

  function leave() {
    depth = Math.max(0, depth - 1);
    if (!depth) dragging = false;
  }

  async function drop(e: DragEvent) {
    e.preventDefault();
    depth = 0;
    dragging = false;
    if (busy || !e.dataTransfer) return;
    onopen(await filesFromDrop(e.dataTransfer));
  }
</script>

<main
  class="welcome"
  class:dragging
  ondragenter={enter}
  ondragover={e => e.preventDefault()}
  ondragleave={leave}
  ondrop={drop}
>
  <div class="top"><LangSwitch /></div>

  <section class="card" aria-busy={busy}>
    <h1>{t('welcome.title')}</h1>
    <p class="lead"><Icon name="lock" size={16} /> {t('welcome.lead')}</p>

    <div class="drop">
      {#if busy}
        {#if progress}
          <p role="status">{t(`progress.${progress.phase}`)}</p>
          <progress class="bar" max="1" value={progress.fraction} aria-label={t(`progress.${progress.phase}`)}></progress>
          <span class="percent">{new Intl.NumberFormat(locale(), { style: 'percent' }).format(progress.fraction)}</span>
        {:else}
          <div class="spinner" aria-hidden="true"></div>
          <p role="status">{t('welcome.loading')}</p>
        {/if}
      {:else}
        <Icon name="upload" size={36} />
        <p>{t('welcome.drop')}</p>
        <p class="or">{t('welcome.or')}</p>
        <div class="actions">
          <label class="button">
            <Icon name="file" size={18} />
            {t('welcome.pickFile')}
            <input class="visually-hidden" type="file" accept=".zip,.txt,application/zip,text/plain" multiple onchange={picked} />
          </label>
          <label class="button secondary">
            <Icon name="folder" size={18} />
            {t('welcome.pickFolder')}
            <input class="visually-hidden" type="file" webkitdirectory onchange={picked} />
          </label>
        </div>
      {/if}
    </div>

    {#if error}
      <p class="error" role="alert">{t(`error.${error}`)}</p>
    {/if}

    {#if canRemember}
      <label class="remember">
        <input type="checkbox" checked={remember} onchange={e => onremember(e.currentTarget.checked)} />
        {t('welcome.remember')}
      </label>
    {/if}

    {#if canRemember && locked}
      <form class="lock" onsubmit={tryUnlock}>
        <h2><Icon name="lock" size={18} /> {t('lock.title')}</h2>
        <p class="note">{t('lock.lead')}</p>
        <div class="row">
          <label class="visually-hidden" for="unlock-password">{t('lock.password')}</label>
          <input id="unlock-password" type="password" autocomplete="current-password" bind:value={password} placeholder={t('lock.password')} />
          <button class="button" type="submit" disabled={!password}>{t('lock.unlock')}</button>
        </div>
        {#if lockError}<p class="error" role="alert">{lockError}</p>{/if}
        <button class="link" type="button" onclick={forgot}>{t('lock.forgot')}</button>
      </form>
    {/if}

    {#if library.length}
      <section class="saved" aria-labelledby="saved-title">
        <h2 id="saved-title">{t('welcome.saved')}</h2>
        <p class="note">{t('welcome.savedNote')}</p>
        <ul>
          {#each library as c (c.id)}
            <li>
              <button class="open" type="button" disabled={busy} onclick={() => onopensaved(c.id)}>
                <span class="name">{c.title ?? t('chat.untitled')}</span>
                <span class="info">
                  {t('chat.messages', { count: c.messages })} · {formatDayRange(c.first, c.last, locale())} · {formatBytes(c.bytes, locale())}
                </span>
              </button>
              {#if confirming === c.id}
                <button class="button danger" type="button" onclick={() => { confirming = null; onremove(c.id); }}>
                  {t('welcome.removeConfirm')}
                </button>
                <button class="button secondary" type="button" onclick={() => (confirming = null)}>{t('welcome.cancel')}</button>
              {:else}
                <button class="button secondary" type="button" onclick={() => (confirming = c.id)}>{t('welcome.remove')}</button>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if canRemember && !locked}
      {#if protectedLibrary}
        <div class="lock-state">
          <p class="note"><Icon name="lock" size={16} /> {t('lock.on')}</p>
          <div class="row">
            <button class="button secondary" type="button" onclick={onlocknow} disabled={working}>{t('lock.lockNow')}</button>
            <button class="button secondary" type="button" onclick={() => void onunprotect()} disabled={working}>
              {working ? t('lock.working') : t('lock.remove')}
            </button>
          </div>
        </div>
      {:else}
        <details class="protect">
          <summary>{t('lock.protect')}</summary>
          <form onsubmit={setPassword}>
            <p class="note">{t('lock.protectLead')}</p>
            <label>{t('lock.password')} <input type="password" autocomplete="new-password" bind:value={password} /></label>
            <label>{t('lock.repeat')} <input type="password" autocomplete="new-password" bind:value={repeat} /></label>
            {#if lockError}<p class="error" role="alert">{lockError}</p>{/if}
            <button class="button" type="submit" disabled={working || !password}>{working ? t('lock.working') : t('lock.set')}</button>
          </form>
        </details>
      {/if}
    {/if}

    <details>
      <summary>{t('welcome.howTo')}</summary>
      <ul>
        <li>{t('welcome.howToAndroid')}</li>
        <li>{t('welcome.howToIos')}</li>
        <li>{t('welcome.howToSend')}</li>
        <li>{t('welcome.howToMerge')}</li>
      </ul>
    </details>
  </section>
</main>

<style>
  .welcome {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
  }

  .top {
    align-self: flex-end;
  }

  .card {
    width: min(560px, 100%);
    margin: auto 0;
    padding: 32px 28px;
    border-radius: 16px;
    background: var(--panel);
    box-shadow: var(--shadow);
    text-align: center;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .lead {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 24px;
    color: var(--muted);
  }

  .drop {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 28px 16px;
    border: 2px dashed var(--panel-border);
    border-radius: 12px;
    color: var(--muted);
  }

  .dragging .drop {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .drop p {
    margin: 0;
    color: var(--text);
  }

  .drop .or {
    color: var(--muted);
    font-size: 0.9em;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 6px;
  }

  .actions label:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .error {
    margin: 16px 0 0;
    color: var(--danger);
  }

  .remember {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    color: var(--muted);
    font-size: 0.9rem;
    cursor: pointer;
  }

  .remember input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }

  .saved {
    margin-top: 24px;
    text-align: start;
  }

  .saved h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .saved .note {
    margin: 2px 0 10px;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .saved ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .saved li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 1px solid var(--panel-border);
    border-radius: 12px;
  }

  .saved .open {
    flex: 1 1 220px;
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: 6px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    text-align: start;
    cursor: pointer;
  }

  .saved .open:hover {
    background: color-mix(in srgb, var(--text) 6%, transparent);
  }

  .saved .name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .saved .info {
    color: var(--muted);
    font-size: 0.82rem;
  }

  .saved .button {
    min-height: 36px;
    padding: 6px 14px;
    font-size: 0.88rem;
  }

  .danger {
    background: var(--danger);
    color: var(--bg);
  }

  .lock,
  .lock-state,
  .protect {
    display: grid;
    gap: 8px;
    margin-top: 20px;
    text-align: start;
  }

  .lock h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1rem;
  }

  .lock .note,
  .lock-state .note,
  .protect .note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--muted);
    font-size: 0.88rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .lock input,
  .protect input {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    padding: 6px 10px;
    border: 1px solid var(--panel-border);
    border-radius: var(--radius);
    background: var(--bg);
  }

  .protect form {
    display: grid;
    gap: 10px;
    margin-top: 10px;
  }

  .protect label {
    display: grid;
    gap: 4px;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .protect .button {
    justify-self: start;
  }

  .link {
    justify-self: start;
    padding: 0;
    border: 0;
    background: none;
    color: var(--link);
    font-size: 0.85rem;
    text-decoration: underline;
    cursor: pointer;
  }

  details {
    margin-top: 20px;
    text-align: start;
    color: var(--muted);
  }

  summary {
    cursor: pointer;
    text-align: center;
  }

  ul {
    padding-inline-start: 20px;
  }

  li + li {
    margin-top: 6px;
  }

  .bar {
    width: min(320px, 100%);
    height: 8px;
    accent-color: var(--accent);
  }

  .percent {
    color: var(--muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--panel-border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar {
    width: min(320px, 100%);
    height: 8px;
    accent-color: var(--accent);
  }

  .percent {
    color: var(--muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  .spinner {
      animation-duration: 3s;
    }
  }
</style>
