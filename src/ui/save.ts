import { isRiskyFile, safeFileName } from '../core';
import { t } from '../i18n/index.svelte';

/**
 * Hands a file to the browser's download, under a name without hidden
 * marks, and asks first when the file is of a kind that can run code.
 */
export function saveFile(url: string, name: string): void {
  const clean = safeFileName(name);
  if (isRiskyFile(clean) && !confirm(t('file.riskyConfirm', { name: clean }))) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = clean;
  a.click();
}

/** For download links: stops the click and asks first when the file can run code. */
export function confirmRisky(e: MouseEvent, name: string): void {
  const clean = safeFileName(name);
  if (isRiskyFile(clean) && !confirm(t('file.riskyConfirm', { name: clean }))) e.preventDefault();
}
