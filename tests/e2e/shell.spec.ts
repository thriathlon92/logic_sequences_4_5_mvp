import { expect, test, type Page } from '@playwright/test';

const browserMessages = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  browserMessages.set(page, messages);
  page.on('pageerror', (error) => messages.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      messages.push(message.text());
  });
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
});

test.afterEach(async ({ page }) => {
  expect(browserMessages.get(page)).toEqual([]);
});

async function checkScreen(page: Page, title: string) {
  await expect(
    page.getByRole('heading', { level: 1, name: title, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const button of await page.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(56);
    expect(box!.height).toBeGreaterThanOrEqual(56);
  }
}

async function activate(page: Page, name: string, touch: boolean) {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeEnabled();
  if (touch) await button.tap();
  else await button.click();
}

async function openTask(page: Page, touch: boolean) {
  await activate(page, 'Начать', touch);
  await checkScreen(page, 'Карта занятий');
  await activate(page, 'Продолжить', touch);
  await checkScreen(page, 'Найди такой же');
}

test('полный путь, возврат на карту и повтор без перезагрузки', async ({
  page,
  isMobile,
}) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await checkScreen(page, 'Логические последовательности 4–5');
  await openTask(page, isMobile);
  await activate(page, 'Круг', isMobile);
  await checkScreen(page, 'Верно!');
  await activate(page, 'Дальше', isMobile);
  await checkScreen(page, 'Занятие завершено!');
  await activate(page, 'На карту', isMobile);
  await checkScreen(page, 'Карта занятий');
  await activate(page, 'Продолжить', isMobile);
  await activate(page, 'Круг', isMobile);
  await activate(page, 'Дальше', isMobile);
  await activate(page, 'Ещё раз', isMobile);
  await checkScreen(page, 'Найди такой же');
});

test('ошибки не блокируют выбор, инструкция повторяется без аудио', async ({
  page,
  isMobile,
}) => {
  await openTask(page, isMobile);
  await activate(page, 'Квадрат', isMobile);
  await checkScreen(page, 'Попробуй ещё');
  await activate(page, 'Квадрат', isMobile);
  await checkScreen(page, 'Попробуй ещё');
  await activate(page, 'Повторить инструкцию', isMobile);
  const instruction = page.getByText('Посмотри на круг. Найди такой же.');
  await expect(instruction).toBeFocused();
  await expect(instruction).toHaveClass(/repeated/);
  await expect(page.locator('audio, video, img, canvas')).toHaveCount(0);
  await activate(page, 'Круг', isMobile);
  await checkScreen(page, 'Верно!');
  await activate(page, 'Дальше', isMobile);
  await checkScreen(page, 'Занятие завершено!');
});

test('полный путь клавиатурой с видимым фокусом', async ({
  page,
  browserName,
}) => {
  // macOS WebKit uses Option+Tab to include native buttons in keyboard navigation.
  const tab =
    browserName === 'webkit' && process.platform === 'darwin'
      ? 'Alt+Tab'
      : 'Tab';
  for (const name of ['Начать', 'Продолжить', 'Круг', 'Дальше', 'На карту']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeEnabled();
    await page.keyboard.press(tab);
    await expect(button).toBeFocused();
    expect(
      await button.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      ),
    ).toBe('solid');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  }
  await checkScreen(page, 'Карта занятий');
});

test('двойные клики и быстрые повторные taps не пропускают экраны', async ({
  page,
  isMobile,
}) => {
  const start = page.getByRole('button', { name: 'Начать' });
  if (isMobile) await start.tap();
  else await start.dblclick();
  await checkScreen(page, 'Карта занятий');
  const next = page.getByRole('button', { name: 'Продолжить' });
  // Coordinate input deliberately bypasses Playwright's wait for enabled controls.
  const box = (await next.boundingBox())!;
  if (isMobile)
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await checkScreen(page, 'Карта занятий');
  await expect(next).toBeEnabled();
  await activate(page, 'Продолжить', isMobile);
  await checkScreen(page, 'Найди такой же');
});

test('узкий экран и поворот планшета не создают горизонтальный скролл', async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 1024, height: 768 } : { width: 320, height: 640 },
  );
  await checkScreen(page, 'Логические последовательности 4–5');
  await openTask(page, isMobile);
  await activate(page, 'Квадрат', isMobile);
  await checkScreen(page, 'Попробуй ещё');
  await activate(page, 'Круг', isMobile);
  await checkScreen(page, 'Верно!');
  await activate(page, 'Дальше', isMobile);
  await checkScreen(page, 'Занятие завершено!');
});
