import { expect, test } from '@playwright/test';
import { openDemo } from './helpers';

test.describe('a browser set to French', () => {
  test.use({ locale: 'fr-FR' });

  test('starts in French', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ouvrir une discussion WhatsApp exportée' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
});

test('writes group events of an English export in German', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Language').selectOption('de');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Home');
  await expect(page.getByText('Deniz Kaya hat die Gruppe „Weekend Plans“ erstellt')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chat schließen' })).toBeVisible();
});

for (const [lang, title] of [
  ['es', 'Abre una exportación de chat de WhatsApp'],
  ['pt', 'Abra uma conversa exportada do WhatsApp'],
  ['it', 'Apri una chat di WhatsApp esportata'],
] as const) {
  test(`offers ${lang}`, async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Language').selectOption(lang);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  });
}
