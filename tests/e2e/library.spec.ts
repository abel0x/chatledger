import { expect, test, type Page } from '@playwright/test';
import { DEMO_TITLE } from './demo';
import { openDemo, waitForSavedCopy } from './helpers';
import { buildTelegramDemo, TELEGRAM_PHOTO, TELEGRAM_TITLE } from './telegram-demo';

/** Saves the WhatsApp demo and the Telegram demo, then goes back to the start page. */
async function saveBoth(page: Page) {
  await openDemo(page, true);
  await waitForSavedCopy(page);
  await page.getByRole('button', { name: 'Close chat' }).click();
  const { json, photo } = buildTelegramDemo();
  await page.locator('input[type=file][accept]').setInputFiles([
    { name: 'result.json', mimeType: 'application/json', buffer: json },
    { name: TELEGRAM_PHOTO, mimeType: 'image/png', buffer: photo },
  ]);
  await expect(page.getByRole('heading', { level: 1, name: TELEGRAM_TITLE })).toBeVisible({ timeout: 20_000 });
  await waitForSavedCopy(page);
  await page.getByRole('button', { name: 'Close chat' }).click();
  await expect(page.getByRole('heading', { name: 'Saved chats', exact: true })).toBeVisible();
}

const searchAll = (page: Page) => page.getByRole('searchbox', { name: 'Search all saved chats' });
const group = (page: Page, title: string) => page.getByRole('region', { name: title });

test('searches every saved chat and opens the one with the match', async ({ page }) => {
  test.setTimeout(90_000);
  await saveBoth(page);

  await searchAll(page).fill('friday');
  await expect(page.getByRole('status')).toHaveText('Found in 1 chat', { timeout: 20_000 });
  await expect(group(page, DEMO_TITLE)).toHaveCount(0);
  await expect(group(page, TELEGRAM_TITLE).locator('mark').first()).toHaveText('Friday');

  // Both chats talk about Saturday plans and baking.
  await searchAll(page).fill('bake');
  await expect(page.getByRole('status')).toHaveText('Found in 2 chats');
  const whatsapp = group(page, DEMO_TITLE);
  await expect(whatsapp.getByRole('listitem')).toHaveCount(5);
  await expect(whatsapp.getByRole('button', { name: /^Show all \d+ in this chat$/ })).toBeVisible();

  await searchAll(page).fill('"something for Friday"');
  const hit = group(page, TELEGRAM_TITLE).getByRole('listitem');
  await expect(hit.locator('mark')).toHaveText('something for Friday');
  await hit.getByRole('button').click();
  await expect(page.getByRole('heading', { level: 1, name: TELEGRAM_TITLE })).toBeVisible();
  await expect(page.locator('.flash')).toContainText('I will bake something for Friday');
  await expect(page.getByPlaceholder('Search…')).toHaveValue('"something for Friday"');
});

test('opens a chat with all its matches listed', async ({ page }) => {
  test.setTimeout(90_000);
  await saveBoth(page);
  await searchAll(page).fill('bake');
  await group(page, DEMO_TITLE)
    .getByRole('button', { name: /^Show all \d+ in this chat$/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: DEMO_TITLE })).toBeVisible();
  await expect(page.getByPlaceholder('Search…')).toHaveValue('bake');
  await expect(page.locator('.results li').nth(5)).toBeVisible();
});

test('tells when nothing is found and brings the list back when cleared', async ({ page }) => {
  test.setTimeout(90_000);
  await saveBoth(page);
  await searchAll(page).fill('zebra');
  await expect(page.getByRole('status')).toHaveText('Nothing found in your saved chats.', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Book Club/ })).toHaveCount(0);
  await searchAll(page).press('Escape');
  await expect(searchAll(page)).toHaveValue('');
  await expect(page.getByRole('button', { name: /Book Club/ })).toBeVisible();
});

test('searches saved chats that are protected with a password', async ({ page }) => {
  test.setTimeout(90_000);
  await saveBoth(page);
  await page.getByText('Protect saved chats with a password').click();
  await page.getByLabel('Password', { exact: true }).fill('trail mix 2025');
  await page.getByLabel('Repeat the password').fill('trail mix 2025');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByText('Saved chats are protected with a password.')).toBeVisible({ timeout: 30_000 });

  // Locking forgets everything read so far; after unlocking, the chats are read again with the password.
  await page.getByRole('button', { name: 'Lock now' }).click();
  await expect(searchAll(page)).toHaveCount(0);
  await page.getByPlaceholder('Password').fill('trail mix 2025');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await searchAll(page).fill('bake');
  await expect(page.getByRole('status')).toHaveText('Found in 2 chats', { timeout: 20_000 });
});
