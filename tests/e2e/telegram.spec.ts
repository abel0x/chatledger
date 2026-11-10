import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { landscape } from './png';

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../fixtures/telegram/${name}`, import.meta.url)));

async function openTelegram(page: Page) {
  await page.goto('/');
  await page.getByLabel('Remember chats I open on this computer').uncheck();
  await page.locator('input[type=file][accept]').setInputFiles([
    { name: 'result.json', mimeType: 'application/json', buffer: fixture('result.json') },
    { name: 'photo_1@01-03-2025_10-00-00.jpg', mimeType: 'image/png', buffer: landscape(1) },
  ]);
  await expect(page.getByRole('heading', { level: 1, name: 'Weekend Hikers' })).toBeVisible();
}

test('opens a Telegram export with its styles, replies, forwards and reactions', async ({ page }) => {
  await openTelegram(page);
  const welcome = page.locator('.row', { hasText: 'Welcome! Read the' });
  await expect(welcome.locator('strong')).toHaveText('rules');
  await expect(welcome.getByRole('link', { name: 'https://example.org/rules' })).toHaveAttribute('href', 'https://example.org/rules');
  await expect(welcome.getByRole('list', { name: 'Reactions' })).toContainText('👍');

  // Stars in Telegram text are plain characters.
  const thanks = page.locator('.row', { hasText: 'see you Saturday' });
  await expect(thanks).toContainText('Thanks *Ada*');
  await expect(thanks.locator('strong')).toHaveCount(0);

  const forwarded = page.locator('.row', { hasText: 'Snow expected' });
  await expect(forwarded).toContainText('Forwarded from Mountain News');
  const spoiler = forwarded.getByRole('button', { name: 'Hidden text, select to show' });
  await spoiler.click();
  await expect(forwarded.locator('.spoiler.shown')).toHaveText('Bring gloves');

  const links = page.locator('.row', { hasText: 'map and site' });
  await expect(links.getByRole('link')).toHaveCount(1);
  await expect(links.getByRole('link', { name: 'site' })).toHaveAttribute('href', 'https://example.org');

  await thanks.getByRole('button', { name: 'In reply to Ada Demir' }).click();
  await expect(page.locator('.flash')).toContainText('Welcome! Read the');
});

test('writes Telegram events in the reader’s language', async ({ page }) => {
  await openTelegram(page);
  await expect(page.getByText('Ada Demir created the group “Hikers”')).toBeVisible();
  await expect(page.getByText('Ada Demir changed the group name to “Weekend Hikers”')).toBeVisible();
});

test('turns away an export of a whole Telegram account', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file][accept]').setInputFiles([
    { name: 'export_results.html', mimeType: 'text/html', buffer: Buffer.from('<html></html>') },
    { name: 'messages.html', mimeType: 'text/html', buffer: fixture('messages.html') },
  ]);
  await expect(page.getByRole('alert')).toContainText('whole Telegram account');
});
