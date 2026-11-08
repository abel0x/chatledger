import { expect, type Page } from '@playwright/test';
import { buildDemo, DEMO_TITLE, type Demo } from './demo';

let cached: Promise<Demo> | null = null;

export function demo(): Promise<Demo> {
  cached ??= buildDemo();
  return cached;
}

export async function openDemo(page: Page, remember = false): Promise<Demo> {
  const d = await demo();
  await page.goto('/');
  if (!remember) await page.getByLabel('Remember chats I open on this computer').uncheck();
  await page.locator('input[type=file][accept]').setInputFiles({ name: d.name, mimeType: 'application/zip', buffer: d.buffer });
  await expect(page.getByRole('heading', { level: 1, name: DEMO_TITLE })).toBeVisible();
  return d;
}

/** Jumps to a message through search, the way a reader would. */
export async function goTo(page: Page, phrase: string) {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByPlaceholder('Search…').fill(`"${phrase}"`);
  await page.locator('.results button').first().click();
  await page.getByRole('button', { name: 'Close search' }).click();
  return page.locator('.row', { hasText: phrase }).first();
}
