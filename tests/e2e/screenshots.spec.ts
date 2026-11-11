import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { buildDemo, DEMO_TITLE } from './demo';
import { buildTelegramDemo, TELEGRAM_PHOTO, TELEGRAM_TITLE } from './telegram-demo';

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

test('README screenshots of Telegram and of searching every saved chat', async ({ page }) => {
  const demo = await buildDemo();
  const telegram = buildTelegramDemo();
  // Tall enough for the whole made-up Telegram chat.
  await page.setViewportSize({ width: 1280, height: 1080 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  const saved = () => expect.poll(() => page.evaluate(() => localStorage.getItem('chatledger.last')), { timeout: 20_000 }).not.toBeNull();

  await page.locator('input[type=file][accept]').setInputFiles({ name: demo.name, mimeType: 'application/zip', buffer: demo.buffer });
  await expect(page.getByRole('heading', { level: 1, name: DEMO_TITLE })).toBeVisible();
  await saved();
  await page.getByRole('button', { name: 'Close chat' }).click();

  await page.locator('input[type=file][accept]').setInputFiles([
    { name: 'result.json', mimeType: 'application/json', buffer: telegram.json },
    { name: TELEGRAM_PHOTO, mimeType: 'image/png', buffer: telegram.photo },
  ]);
  await expect(page.getByRole('heading', { level: 1, name: TELEGRAM_TITLE })).toBeVisible();
  await expect(page.locator('.frame img').first()).toBeVisible();
  await page.mouse.move(0, 400);
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('telegram') });
  await saved();
  await page.getByRole('button', { name: 'Close chat' }).click();

  await page.getByRole('searchbox', { name: 'Search all saved chats' }).fill('bake');
  await expect(page.getByRole('status')).toHaveText('Found in 2 chats');
  await page.mouse.move(0, 0);
  const box = await page.locator('.saved').boundingBox();
  if (!box) throw new Error('no saved chats');
  await page.screenshot({ path: shot('everywhere'), fullPage: true, clip: { x: box.x - 24, y: box.y - 20, width: box.width + 48, height: box.height + 40 } });
});
