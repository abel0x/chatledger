import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Runs against real exports kept in coldstorage/ on this machine only, and
 * keeps no screenshots or traces of them. Skipped everywhere else.
 */
const dir = fileURLToPath(new URL('../../coldstorage/', import.meta.url));
const archives = existsSync(dir)
  ? readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.zip'))
      .sort((a, b) => statSync(join(dir, b)).size - statSync(join(dir, a)).size)
  : [];

test.use({ screenshot: 'off', trace: 'off', video: 'off' });
test.skip(!archives.length, 'no real exports on this machine');

test('every document in the largest real export opens in the preview', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByLabel('Remember chats I open on this computer').uncheck();
  // Playwright's Chromium on Linux drops files whose path is not plain ASCII; a plain link avoids that.
  const link = fileURLToPath(new URL(`../../test-results/real-${test.info().project.name}.zip`, import.meta.url));
  mkdirSync(dirname(link), { recursive: true });
  rmSync(link, { force: true });
  try {
    symlinkSync(join(dir, archives[0] ?? ''), link);
  } catch {
    // Windows only allows links with extra rights; a copy does the same job.
    copyFileSync(join(dir, archives[0] ?? ''), link);
  }
  await page.locator('input[type=file][accept]').setInputFiles(link);
  // Real chats often open with a run of group events, so wait for any line of the list.
  await expect(page.locator('.vl-item').first()).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Media, files and links' }).click();
  await page.getByRole('tab', { name: /^Files/ }).click();
  const rows = page.locator('.rows li');
  const count = await rows.count();
  let previewed = 0;
  for (let i = 0; i < count; i++) {
    const name = (await rows.nth(i).locator('.name').textContent()) ?? '';
    if (!/\.(pdf|docx)$/i.test(name)) continue;
    await rows.nth(i).getByRole('button', { name: 'Show in chat' }).click();
    await page.locator('.row.flash').getByRole('button', { name: 'Open' }).click();
    const dialog = page.getByRole('dialog', { name: 'Document preview' });
    await expect(dialog.locator('canvas, article').first()).toBeVisible({ timeout: 20_000 });
    await expect(dialog).not.toContainText('cannot be shown');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    previewed++;
  }
  expect(previewed).toBeGreaterThan(0);
  rmSync(link, { force: true });
});
