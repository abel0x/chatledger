import { expect, test, type Page } from '@playwright/test';
import { DEMO_TITLE } from './demo';
import { openDemo, waitForSavedCopy } from './helpers';

/** What the browser's private storage holds for saved chats: file names and whether any of them mention the chat. */
function storage(page: Page) {
  return page.evaluate(async () => {
    const top = await navigator.storage.getDirectory();
    const chats = await top.getDirectoryHandle('chats');
    const names: string[] = [];
    let readable = false;
    for await (const dir of chats.values()) {
      if (dir.kind !== 'directory') continue;
      for await (const file of (dir as FileSystemDirectoryHandle).values()) {
        names.push(file.name);
        const text = await (await (file as FileSystemFileHandle).getFile()).slice(0, 2_000_000).text();
        if (text.includes('Weekend') || text.includes('Deniz')) readable = true;
      }
    }
    return { names, readable };
  });
}

test('protects saved chats with a password', async ({ page }) => {
  test.setTimeout(90_000);
  await openDemo(page, true);
  await waitForSavedCopy(page);
  await page.getByRole('button', { name: 'Close chat' }).click();

  await page.getByText('Protect saved chats with a password').click();
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Repeat the password').fill('short');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByRole('alert')).toHaveText('Use at least 8 characters.');
  await page.getByLabel('Password', { exact: true }).fill('trail mix 2025');
  await page.getByLabel('Repeat the password').fill('trail mix 2025');
  await page.getByRole('button', { name: 'Set password' }).click();
  await expect(page.getByText('Saved chats are protected with a password.')).toBeVisible();

  const sealed = await storage(page);
  expect(sealed.readable).toBe(false);
  expect(sealed.names.every(n => /^\d+\.bin$|^chat\.enc$/.test(n))).toBe(true);

  await page.getByRole('button', { name: 'Lock now' }).click();
  await expect(page.getByText(DEMO_TITLE)).toHaveCount(0);
  await page.getByPlaceholder('Password').fill('wrong password');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('alert')).toHaveText('That password is not right.');
  await page.getByPlaceholder('Password').fill('trail mix 2025');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.locator('.saved .open').filter({ hasText: DEMO_TITLE }).click();
  await expect(page.getByRole('heading', { level: 1, name: DEMO_TITLE })).toBeVisible();

  // After a reload the last chat waits for the password, then opens by itself.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saved chats are locked' })).toBeVisible();
  await page.getByPlaceholder('Password').fill('trail mix 2025');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { level: 1, name: DEMO_TITLE })).toBeVisible();
  await page.getByRole('button', { name: 'Close chat' }).click();

  await page.getByRole('button', { name: 'Remove the password' }).click();
  await expect(page.getByText('Protect saved chats with a password')).toBeVisible();
  expect((await storage(page)).names).toContain('chat.json');
});
