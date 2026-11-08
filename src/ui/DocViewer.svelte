<script lang="ts">
  import { onMount } from 'svelte';
  import { extensionOf, safeFileName } from '../core';
  import { t } from '../i18n/index.svelte';
  import type { DocPreview, Session } from '../loader/client';
  import Icon from './Icon.svelte';

  let { file, session, onclose }: { file: string; session: Session; onclose: () => void } = $props();

  /** Long PDFs open quickly; the whole file can still be saved. */
  const PAGE_LIMIT = 40;

  let dialog = $state<HTMLDialogElement>();
  let pagesBox = $state<HTMLDivElement>();
  let phase = $state<'loading' | 'ready' | 'failed'>('loading');
  let doc = $state.raw<DocPreview | null>(null);
  let pageCount = $state(0);
  let saveUrl = $state<string | null>(null);
  let cancelled = false;

  async function renderPdf() {
    const blob = await session.blob(file);
    if (!blob) throw new Error('missing');
    const pdfjs = await import('pdfjs-dist');
    const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), disableFontFace: true, enableXfa: false })
      .promise;
    pageCount = pdf.numPages;
    phase = 'ready';
    const width = Math.min(860, (pagesBox?.clientWidth ?? 800) - 2);
    const dpr = Math.min(2, devicePixelRatio || 1);
    for (let n = 1; n <= Math.min(pdf.numPages, PAGE_LIMIT) && !cancelled; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.setAttribute('aria-label', `${n} / ${pdf.numPages}`);
      pagesBox?.append(canvas);
      await page.render({ canvas, viewport }).promise;
    }
    await pdf.loadingTask.destroy();
  }

  onMount(() => {
    dialog?.showModal();
    void session.url(file).then(u => (saveUrl = u));
    const run = async () => {
      if (extensionOf(file) === 'pdf') await renderPdf();
      else {
        doc = await session.doc(file);
        if (!doc) throw new Error('unsupported');
        phase = 'ready';
      }
    };
    run().catch(() => {
      if (!cancelled) phase = 'failed';
    });
    return () => {
      cancelled = true;
    };
  });
</script>

<dialog bind:this={dialog} aria-label={t('doc.label')} onclose={onclose}>
  <header>
    <div class="title">
      <strong>{safeFileName(file)}</strong>
      {#if pageCount}<span>{t('doc.pages', { count: pageCount })}</span>{/if}
    </div>
    {#if saveUrl}
      <a class="icon-button" href={saveUrl} download={safeFileName(file)} aria-label={t('msg.download')} title={t('msg.download')}>
        <Icon name="download" />
      </a>
    {/if}
    <button class="icon-button" type="button" onclick={() => dialog?.close()} aria-label={t('doc.close')} title={t('doc.close')}>
      <Icon name="close" />
    </button>
  </header>

  <div class="body">
    {#if phase === 'loading'}
      <p class="note">{t('doc.loading')}</p>
    {:else if phase === 'failed'}
      <p class="note">{t('doc.failed')}</p>
    {/if}

    {#if pageCount > PAGE_LIMIT}<p class="note">{t('doc.firstPages', { count: PAGE_LIMIT })}</p>{/if}
    <div class="pages" bind:this={pagesBox}></div>

    {#if doc?.kind === 'text'}
      <pre>{doc.text}{doc.cut ? '\n…' : ''}</pre>
    {:else if doc?.kind === 'docx'}
      <article class="docx">
        {#each doc.blocks as block, i (i)}
          {#if block.kind === 'table'}
            <div class="table-wrap">
              <table>
                <tbody>
                  {#each block.rows as row, r (r)}
                    <tr>{#each row as cell, c (c)}<td>{cell}</td>{/each}</tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <svelte:element this={block.kind === 'li' ? 'p' : block.kind} class:li={block.kind === 'li'}>
              {#each block.runs as run, k (k)}<span class:b={run.b} class:i={run.i} class:u={run.u}>{run.text}</span>{/each}
            </svelte:element>
          {/if}
        {/each}
      </article>
    {/if}
  </div>
</dialog>

<style>
  dialog {
    display: flex;
    flex-direction: column;
    width: min(920px, calc(100vw - 24px));
    height: calc(100dvh - 24px);
    max-height: none;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: var(--panel);
    color: var(--text);
  }

  dialog:not([open]) {
    display: none;
  }

  dialog::backdrop {
    background: #0b141ab3;
  }

  header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px 8px 18px;
    border-bottom: 1px solid var(--panel-border);
  }

  .title {
    flex: 1;
    min-width: 0;
    display: grid;
  }

  .title strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title span,
  .note {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .body {
    flex: 1;
    overflow: auto;
    padding: 16px;
    background: var(--bg);
  }

  .note {
    margin: 0 0 12px;
    text-align: center;
  }

  .pages {
    display: grid;
    justify-items: center;
    gap: 12px;
  }

  .pages :global(canvas) {
    max-width: 100%;
    height: auto;
    background: #fff;
    box-shadow: 0 1px 4px #0b141a33;
  }

  pre {
    margin: 0 auto;
    max-width: 860px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: ui-monospace, 'Cascadia Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace;
    font-size: 0.88rem;
  }

  .docx {
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 32px;
    background: var(--bubble-in);
    box-shadow: var(--shadow);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .docx :is(p, h1, h2, h3) {
    margin: 0 0 10px;
  }

  .docx .li::before {
    content: '•';
    margin-inline-end: 8px;
  }

  .b {
    font-weight: 700;
  }

  .i {
    font-style: italic;
  }

  .u {
    text-decoration: underline;
  }

  .table-wrap {
    overflow-x: auto;
    margin-bottom: 12px;
  }

  table {
    border-collapse: collapse;
    font-size: 0.88rem;
  }

  td {
    padding: 4px 8px;
    border: 1px solid var(--panel-border);
    vertical-align: top;
    white-space: pre-wrap;
  }
</style>
