import { expect, test } from '@playwright/test';
import { DEMO_TITLE, type Demo } from './demo';
import { demo as loadDemo, openDemo, waitForSavedCopy } from './helpers';

let demo: Demo;

test.beforeAll(async () => {
  demo = await loadDemo();
});

test('opens an export and shows its messages', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('.row').first()).toBeVisible();
  await expect(page.getByText('Deniz Kaya created the group “Weekend Plans”')).toBeVisible();
  await expect(page).toHaveTitle(`${DEMO_TITLE} · chatledger`);
});

test('finds a message regardless of accents and jumps to it', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search…').fill('"see you all on saturday"');
  const result = page.locator('.results button').first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.locator('.row.flash')).toContainText('See you all on Saturday');
  await expect(page.locator('.row.flash mark')).toHaveCount(1);
});

test('shows photos in the gallery and the viewer', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Media, files and links' }).click();
  await expect(page.locator('.tile')).toHaveCount(demo.images.length);
  // The gallery lists the newest first; start from the oldest.
  await page.locator('.tile').last().click();
  const picture = page.locator('.viewer img');
  await expect(picture).toBeVisible();
  await expect(page.locator('.viewer .pos')).toHaveText(`1 of ${demo.images.length}`);
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.viewer .pos')).toHaveText(`2 of ${demo.images.length}`);
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewer')).toHaveCount(0);
});

test('draws the statistics', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Statistics' }).click();
  await expect(page.getByRole('heading', { name: 'Who wrote the most' })).toBeVisible();
  await expect(page.locator('.heat .cell')).toHaveCount(168);
  await page.getByLabel('Show the numbers as tables').check();
  await expect(page.getByRole('cell', { name: 'Selin Arslan' }).or(page.getByRole('rowheader', { name: 'Selin Arslan' }))).toBeVisible();
});

test('keeps a chat after a reload and forgets it when removed', async ({ page }) => {
  await openDemo(page, true);
  await waitForSavedCopy(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: DEMO_TITLE })).toBeVisible();
  await page.getByRole('button', { name: 'Close chat' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Remove for good' }).click();
  await expect(page.getByRole('heading', { name: 'Saved chats', exact: true })).toHaveCount(0);
});

test('switches the interface to Turkish', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Language').selectOption('tr');
  await expect(page.getByRole('button', { name: 'Sohbeti kapat' })).toBeVisible();
  await expect(page.getByText('Deniz Kaya, “Weekend Plans” grubunu oluşturdu')).toBeVisible();
});

test('tells the local server that a page is open', async ({ page }) => {
  const ping = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === '/alive');
  await page.goto('/');
  const response = await (await ping).response();
  expect(response?.status()).toBe(204);
});
