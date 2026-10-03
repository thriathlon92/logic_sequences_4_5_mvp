import { expect, test } from '@playwright/test';

test('стартовая страница открывается без ошибок и горизонтального скролла', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      errors.push(message.text());
  });
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Логические последовательности 4–5',
    }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByRole('main')).toBeVisible();
  expect(errors).toEqual([]);
});
