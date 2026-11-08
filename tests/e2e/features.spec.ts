import { expect, test } from '@playwright/test';
import { DEMO_TITLE } from './demo';
import { goTo, openDemo } from './helpers';

test('shows WhatsApp formatting, mentions and large emoji', async ({ page }) => {
  await openDemo(page);
  const plan = await goTo(page, 'meet at');
  await expect(plan.locator('strong')).toHaveText('Plan for Saturday');
  await expect(plan.locator('em')).toHaveText('8:00');
  await expect(plan.locator('s')).toHaveText('or 9');
  await expect(plan.locator('code')).toHaveText('water');
  await expect(page.locator('.jumbo2')).toHaveText('🥾⛰️');

  const mention = (await goTo(page, 'can you bring the map')).getByRole('button', { name: '@Mert Aydın' });
  await mention.click();
  await expect(page.locator('.panel select').first()).toHaveValue(/\d+/);
  await expect(page.locator('.results button').first()).toContainText('Mert Aydın');
});

test('stars a message from its menu and lists it', async ({ page }) => {
  await openDemo(page);
  const row = await goTo(page, 'See you all on Saturday');
  await row.hover();
  await row.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('menuitem', { name: 'Star' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Message starred' })).toBeVisible();
  await expect(row.locator('.star')).toBeVisible();
  await page.keyboard.press('s');
  await expect(page.getByRole('complementary', { name: 'Starred messages' })).toContainText('See you all on Saturday');
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
});

test('opens a link to a message after a reload', async ({ page }) => {
  await openDemo(page, true);
  await goTo(page, 'Booked for six people');
  await expect(page).toHaveURL(/#m-[\w-]+$/);
  const link = page.url();
  await page.goto('about:blank');
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1, name: DEMO_TITLE })).toBeVisible();
  await expect(page.locator('.row.flash')).toContainText('Booked for six people');
});

test('plays voice messages with a speed control', async ({ page }) => {
  await openDemo(page);
  await goTo(page, 'PTT-20251101-WA0100');
  const player = page.locator('.row.flash .player');
  await expect(player).toBeVisible();
  await expect.poll(() => player.locator('input[type=range]').getAttribute('max')).not.toBe('0');
  const speed = player.getByRole('button', { name: /Playback speed/ });
  await expect(speed).toHaveText('1×');
  await speed.click();
  await expect(speed).toHaveText('1.5×');
  await speed.click();
  await speed.click();
});

test('previews Word and PDF documents', async ({ page }) => {
  await openDemo(page);
  const word = await goTo(page, 'Packing list.docx');
  await word.getByRole('button', { name: 'Open' }).click();
  const dialog = page.getByRole('dialog', { name: 'Document preview' });
  await expect(dialog.getByRole('heading', { name: 'Packing list' })).toBeVisible();
  await expect(dialog.locator('.b')).toHaveText('Rain jacket');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  const pdf = await goTo(page, 'Trip plan.pdf');
  await pdf.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('dialog', { name: 'Document preview' }).locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: 'Document preview' })).toContainText('1 page');
});

test('shows group history, members and a random message', async ({ page }) => {
  await openDemo(page);
  await page.keyboard.press('i');
  const info = page.getByRole('complementary', { name: 'Group info' });
  await expect(info).toContainText('Created by Deniz Kaya');
  await expect(info).toContainText('“Weekend Plans” → “Weekend Hikers”');
  await expect(info).toContainText('6 in the group');
  await info.getByRole('button', { name: 'Show a random message' }).click();
  await expect(page.locator('.row.flash')).toHaveCount(1);
});

test('moves through time with the timeline', async ({ page }) => {
  await openDemo(page);
  const rail = page.getByRole('slider', { name: 'Timeline' });
  const start = await rail.getAttribute('aria-valuenow');
  await rail.focus();
  await page.keyboard.press('End');
  await expect.poll(() => rail.getAttribute('aria-valuenow')).not.toBe(start);
  await expect(page.getByText('Booked for six people').or(page.getByText('See you all on Saturday')).first()).toBeVisible();
});

test('changes theme and text size, and lists the shortcuts', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Dark').check();
  await page.getByLabel('Large').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-size', 'large');
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  const keys = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(keys).toContainText('Search messages');
  await page.keyboard.press('Escape');
  await expect(keys).toHaveCount(0);
});

test('steps through search results with Enter', async ({ page }) => {
  await openDemo(page);
  await page.keyboard.press('/');
  await page.getByPlaceholder('Search…').fill('view');
  await page.getByPlaceholder('Search…').press('Enter');
  await expect(page.locator('.count')).toContainText(/^1 of \d+/);
  await page.getByPlaceholder('Search…').press('Enter');
  await expect(page.locator('.count')).toContainText(/^2 of \d+/);
  await page.getByPlaceholder('Search…').press('Shift+Enter');
  await expect(page.locator('.count')).toContainText(/^1 of \d+/);
  await expect(page.locator('.row.flash mark').first()).toBeVisible();
});
