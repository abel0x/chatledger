import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { buildDemo, DEMO_TITLE } from './demo';

/** Pictures for the README, taken from the made-up demo chat. Run with `npm run screenshots`. */
const shot = (name: string) => fileURLToPath(new URL(`../../docs/screenshots/${name}.png`, import.meta.url));

test('README screenshots', async ({ page }) => {
  const demo = await buildDemo();
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Remember chats I open on this computer').uncheck();
  await page.screenshot({ path: shot('start') });

  await page.locator('input[type=file][accept]').setInputFiles({ name: demo.name, mimeType: 'application/zip', buffer: demo.buffer });
  await expect(page.getByRole('heading', { level: 1, name: DEMO_TITLE })).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search…').fill('view');
  await page.locator('.results button').nth(1).click();
  await page.waitForTimeout(2600);
  await page.screenshot({ path: shot('search') });

  await page.getByRole('button', { name: 'Media, files and links' }).click();
  await expect(page.locator('.tile img').first()).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('gallery') });
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Statistics' }).click();
  await expect(page.locator('.heat .cell').first()).toBeVisible();
  await page.screenshot({ path: shot('stats') });
});
