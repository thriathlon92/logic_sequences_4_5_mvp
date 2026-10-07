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

async function checkGuideStyles(page: Page) {
  const visual = await page.locator('.action-guide').evaluate((element) => {
    const style = getComputedStyle(element);
    const target = document.getElementById(
      element.getAttribute('data-guide-target')!,
    );
    const primary =
      target?.tagName === 'BUTTON' ? getComputedStyle(target) : null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = element.getAnimations()[0];
    const frames =
      animation?.effect instanceof KeyframeEffect
        ? animation.effect.getKeyframes().map((frame) => {
            const matrix = new DOMMatrix(String(frame.transform));
            return { y: matrix.m42, scale: matrix.m11 };
          })
        : [];
    function contrast(first: string, second: string) {
      function luminance(color: string) {
        const channels = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((channel) => channel / 255)
          .map((channel) =>
            channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4,
          );
        return (
          channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
        );
      }
      const a = luminance(first);
      const b = luminance(second);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    return {
      reduced,
      color: style.color,
      shaft: getComputedStyle(element, '::before').backgroundColor,
      tip: getComputedStyle(element, '::after').borderTopColor,
      shadow: style.filter,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      name: style.animationName,
      duration: parseFloat(style.animationDuration) * 1000,
      easing: style.animationTimingFunction,
      iterations: style.animationIterationCount,
      frames,
      primary: primary && {
        background: primary.backgroundColor,
        shadow: primary.boxShadow,
        name: primary.animationName,
        contrast: contrast(style.color, primary.backgroundColor),
      },
    };
  });
  expect(visual.color).toBe('rgb(255, 176, 0)');
  expect(visual.shaft).toBe(visual.color);
  expect(visual.tip).toBe(visual.color);
  expect(visual.opacity).toBe('1');
  expect(visual.shadow).toContain('drop-shadow');
  expect(visual.pointerEvents).toBe('none');
  if (visual.primary) {
    expect(visual.color).not.toBe(visual.primary.background);
    expect(visual.primary.contrast).toBeGreaterThan(3);
    expect(visual.primary.shadow).toContain(visual.color);
    const spread = parseFloat(
      visual.primary.shadow.match(/[\d.]+px/g)!.slice(-1)[0]!,
    );
    expect(spread).toBeGreaterThanOrEqual(5);
    expect(spread).toBeLessThanOrEqual(10);
    expect(visual.primary.name).toBe(visual.reduced ? 'none' : 'action-pulse');
  }
  if (visual.reduced) {
    expect(visual.name).toBe('none');
  } else {
    expect(visual.name).toBe('guide-nudge');
    expect(visual.duration).toBeGreaterThanOrEqual(800);
    expect(visual.duration).toBeLessThanOrEqual(1100);
    expect(visual.easing).toBe('ease-in-out');
    expect(visual.iterations).toBe('infinite');
    const amplitude = Math.max(...visual.frames.map((frame) => frame.y));
    expect(amplitude).toBeGreaterThanOrEqual(12);
    expect(amplitude).toBeLessThanOrEqual(20);
    expect(Math.min(...visual.frames.map((frame) => frame.y))).toBe(0);
    const lower = visual.frames.find((frame) => frame.y === amplitude)!;
    expect(lower.scale).toBeGreaterThan(1);
    expect(lower.scale).toBeLessThanOrEqual(1.1);
  }
}

async function checkScreen(page: Page, title: string) {
  await expect(
    page.getByRole('heading', { level: 1, name: title, exact: true }),
  ).toBeVisible();
  const guide = page.locator('.action-guide');
  await expect(guide).toHaveCount(1);
  await expect(guide).toBeVisible();
  await checkGuideStyles(page);
  const targetId = await guide.getAttribute('data-guide-target');
  const target = page.locator(`#${targetId}`);
  await expect(target).toBeVisible();
  if (await target.evaluate((element) => element.tagName === 'BUTTON')) {
    await expect(target).toHaveAccessibleName(/.+/);
    await expect(page.locator('.guided-action')).toHaveCount(1);
  } else {
    await expect(target).toHaveRole('group');
    await expect(page.locator('.guided-action')).toHaveCount(0);
  }
  const arrowBox = (await guide.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  expect(arrowBox.y + arrowBox.height).toBeLessThanOrEqual(targetBox.y + 6);
  expect(arrowBox.x + arrowBox.width / 2).toBeGreaterThan(targetBox.x);
  expect(arrowBox.x + arrowBox.width / 2).toBeLessThan(
    targetBox.x + targetBox.width,
  );
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
  await activate(page, 'Начать демонстрационное занятие', touch);
  await checkScreen(page, 'Найди такой же');
}

test('полный путь, возврат на карту и повтор без перезагрузки', async ({
  page,
  isMobile,
}) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await checkScreen(page, 'Логические последовательности 4–5');
  await openTask(page, isMobile);
  await activate(page, 'Синий круг с жёлтой точкой', isMobile);
  await checkScreen(page, 'Верно!');
  await activate(page, 'Дальше', isMobile);
  await checkScreen(page, 'Занятие завершено!');
  await activate(page, 'На карту', isMobile);
  await checkScreen(page, 'Карта занятий');
  await activate(page, 'Начать демонстрационное занятие', isMobile);
  await activate(page, 'Синий круг с жёлтой точкой', isMobile);
  await activate(page, 'Дальше', isMobile);
  await activate(page, 'Ещё раз', isMobile);
  await checkScreen(page, 'Найди такой же');
});

test('ошибки не блокируют выбор, инструкция повторяется без аудио', async ({
  page,
  isMobile,
}) => {
  await openTask(page, isMobile);
  await activate(page, 'Синий круг без точки', isMobile);
  await checkScreen(page, 'Попробуй ещё');
  await activate(page, 'Синий круг без точки', isMobile);
  await checkScreen(page, 'Попробуй ещё');
  await activate(page, 'Повторить инструкцию', isMobile);
  const instruction = page.getByText('Посмотри на образец. Найди такой же.');
  await expect(instruction).toBeFocused();
  await expect(page.locator('.matching')).toHaveClass(/highlighted/);
  await expect(page.locator('audio, video, img, canvas')).toHaveCount(0);
  await activate(page, 'Синий круг с жёлтой точкой', isMobile);
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
  for (const name of [
    'Начать',
    'Начать демонстрационное занятие',
    'Синий круг с жёлтой точкой',
    'Дальше',
    'На карту',
  ]) {
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
  // Freeze browser time: geometry assertions on a slow CI must not consume
  // the 500 ms input lock before the deliberately rapid second tap.
  await page.clock.install({ time: new Date('2026-10-06T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-06T12:00:01Z'));
  await page.reload();
  const start = page.getByRole('button', { name: 'Начать' });
  if (isMobile) await start.tap();
  else await start.dblclick();
  await checkScreen(page, 'Карта занятий');
  const next = page.getByRole('button', {
    name: 'Начать демонстрационное занятие',
  });
  // Coordinate input deliberately bypasses Playwright's wait for enabled controls.
  const box = (await next.boundingBox())!;
  if (isMobile)
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await checkScreen(page, 'Карта занятий');
  await expect(next).toBeDisabled();
  await page.clock.runFor(499);
  await expect(next).toBeDisabled();
  await page.clock.runFor(1);
  await expect(next).toBeEnabled();
  await activate(page, 'Начать демонстрационное занятие', isMobile);
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
  await activate(page, 'Синий круг без точки', isMobile);
  await checkScreen(page, 'Попробуй ещё');
  await activate(page, 'Синий круг с жёлтой точкой', isMobile);
  await checkScreen(page, 'Верно!');
  await activate(page, 'Дальше', isMobile);
  await checkScreen(page, 'Занятие завершено!');
});

test('три ответа различаются структурой, образец отделён, ошибки не раскрывают ответ', async ({
  page,
  isMobile,
}) => {
  await openTask(page, isMobile);
  const answers = page.getByRole('group', { name: 'Выбери такую же фигуру' });
  const buttons = answers.getByRole('button');
  await expect(buttons).toHaveCount(3);
  await expect(answers.locator('.dot')).toHaveCount(1);
  await expect(answers.locator('.inner.square')).toHaveCount(1);
  const sample = page.getByRole('img', {
    name: 'Образец: синий круг с жёлтой точкой',
  });
  expect(
    await sample.evaluate((element) => element.closest('.answers')),
  ).toBeNull();
  const dot = answers.locator('.dot');
  const square = answers.locator('.inner.square');
  expect(
    await dot.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(
    await square.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  );
  expect(
    await dot.evaluate((element) => getComputedStyle(element).borderRadius),
  ).not.toBe(
    await square.evaluate((element) => getComputedStyle(element).borderRadius),
  );
  for (const name of [
    'Синий круг без точки',
    'Синий круг без точки',
    'Синий круг с жёлтым квадратом',
  ]) {
    await activate(page, name, isMobile);
    for (const button of await buttons.all())
      await expect(button).toBeEnabled();
    await expect(page.locator('.matching')).toHaveClass(/highlighted/);
    await expect(page.locator('.action-guide')).toHaveAttribute(
      'data-guide-target',
      'answers',
    );
    await expect(answers.locator('.action-guide, .guided-action')).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', {
        name: 'Синий круг с жёлтой точкой',
        exact: true,
      }),
    ).toHaveClass('answer');
    await expect(page.getByRole('button', { name, exact: true })).toHaveClass(
      /mistaken/,
    );
    await checkScreen(page, 'Попробуй ещё');
  }
  await expect(page.getByRole('status')).toHaveText('Попробуй ещё. Попытка 3.');
  await activate(page, 'Синий круг с жёлтой точкой', isMobile);
  await checkScreen(page, 'Верно!');
});

test('reduced motion сохраняет статические указатели и полностью отключает анимации', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  async function checkStatic(title: string) {
    await checkScreen(page, title);
    const arrow = page.locator('.action-guide');
    expect(
      await arrow.evaluate(
        (element) => getComputedStyle(element, '::before').backgroundColor,
      ),
    ).not.toBe('rgba(0, 0, 0, 0)');
    expect(
      await arrow.evaluate((element) =>
        parseFloat(getComputedStyle(element, '::after').borderTopWidth),
      ),
    ).toBeGreaterThan(0);
    const animated = await page
      .locator('.panel, .panel *')
      .evaluateAll((elements) =>
        elements
          .filter((element) =>
            ['', '::before', '::after'].some(
              (pseudo) =>
                getComputedStyle(element, pseudo || null).animationName !==
                'none',
            ),
          )
          .map((element) => element.className),
      );
    expect(animated).toEqual([]);
  }
  await checkStatic('Логические последовательности 4–5');
  const screenshot = testInfo.outputPath('09-reduced-motion.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('reduced-motion', {
    path: screenshot,
    contentType: 'image/png',
  });
  await activate(page, 'Начать', isMobile);
  await checkStatic('Карта занятий');
  await activate(page, 'Начать демонстрационное занятие', isMobile);
  await checkStatic('Найди такой же');
  await activate(page, 'Синий круг без точки', isMobile);
  await checkStatic('Попробуй ещё');
  await activate(page, 'Синий круг с жёлтым квадратом', isMobile);
  await checkStatic('Попробуй ещё');
  await activate(page, 'Синий круг с жёлтой точкой', isMobile);
  await checkStatic('Верно!');
  await activate(page, 'Дальше', isMobile);
  await checkStatic('Занятие завершено!');
  await activate(page, 'На карту', isMobile);
  await checkStatic('Карта занятий');
});

test('успех, приоритет возврата на карту и скриншоты ключевых экранов', async ({
  page,
  isMobile,
}, testInfo) => {
  async function capture(name: string, title: string) {
    await checkScreen(page, title);
    const screenshot = testInfo.outputPath(`${name}.png`);
    await page.screenshot({
      path: screenshot,
      fullPage: true,
      animations: 'disabled',
    });
    await testInfo.attach(name, { path: screenshot, contentType: 'image/png' });
  }
  await capture('01-welcome', 'Логические последовательности 4–5');
  await activate(page, 'Начать', isMobile);
  await capture('02-map', 'Карта занятий');
  await expect(page.getByRole('button')).toHaveCount(1);
  await expect(page.locator('.lesson')).toHaveRole('button');
  await activate(page, 'Начать демонстрационное занятие', isMobile);
  await capture('03-task', 'Найди такой же');
  await activate(page, 'Синий круг без точки', isMobile);
  await capture('04-incorrect', 'Попробуй ещё');
  await activate(page, 'Синий круг с жёлтой точкой', isMobile);
  await expect(page.locator('.success-mark')).toBeVisible();
  await expect(page.locator('.success-mark')).toHaveText('✓');
  await expect(page.getByRole('status')).toHaveText('✓Получилось!');
  await capture('05-correct', 'Верно!');
  await activate(page, 'Дальше', isMobile);
  await capture('06-complete', 'Занятие завершено!');
  const home = page.getByRole('button', { name: 'На карту', exact: true });
  const repeat = page.getByRole('button', { name: 'Ещё раз', exact: true });
  await expect(home.locator('.home-icon')).toBeVisible();
  const homeBox = (await home.boundingBox())!;
  const repeatBox = (await repeat.boundingBox())!;
  expect(homeBox.width * homeBox.height).toBeGreaterThan(
    repeatBox.width * repeatBox.height,
  );
  expect(homeBox.y).toBeLessThan(repeatBox.y);
  expect(
    await home.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe(
    await repeat.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  );
  await expect(home).toHaveClass(/guided-action/);
  await expect(repeat).not.toHaveClass(/guided-action/);
});

test('движется сама стрелка, кольцо меняет толщину, ответы равноправны', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await checkScreen(page, 'Логические последовательности 4–5');
  const guide = page.locator('.action-guide');
  const start = page.getByRole('button', { name: 'Начать', exact: true });
  async function phase(time: number, name: string) {
    await page
      .locator('.action-guide, .guided-action')
      .evaluateAll((elements, time) => {
        for (const element of elements) {
          const animation = element.getAnimations()[0];
          if (!animation)
            throw new Error('Expected CSS animation for guidance');
          animation.pause();
          animation.currentTime = time;
        }
      }, time);
    const geometry = {
      arrow: (await guide.boundingBox())!,
      button: (await start.boundingBox())!,
      transform: await guide.evaluate(
        (element) => getComputedStyle(element).transform,
      ),
      ring: await start.evaluate(
        (element) => getComputedStyle(element).boxShadow,
      ),
    };
    const screenshot = testInfo.outputPath(`${name}.png`);
    await page.screenshot({
      path: screenshot,
      fullPage: true,
      animations: 'allow',
    });
    await testInfo.attach(name, { path: screenshot, contentType: 'image/png' });
    return geometry;
  }
  const top = await phase(0, '07-welcome-motion-start');
  const bottom = await phase(475, '08-welcome-motion-near');
  const centerShift =
    bottom.arrow.y +
    bottom.arrow.height / 2 -
    (top.arrow.y + top.arrow.height / 2);
  expect(centerShift).toBeCloseTo(16, 1);
  expect(bottom.arrow.width / top.arrow.width).toBeCloseTo(1.08, 2);
  expect(bottom.arrow.height / top.arrow.height).toBeCloseTo(1.08, 2);
  expect(bottom.button).toEqual(top.button);
  expect(bottom.ring).not.toBe(top.ring);
  expect(bottom.arrow.y + bottom.arrow.height).toBeLessThan(bottom.button.y);
  await testInfo.attach('arrow-motion-measurements', {
    body: JSON.stringify({ top, bottom, centerShift }, null, 2),
    contentType: 'application/json',
  });
  await page
    .locator('.action-guide, .guided-action')
    .evaluateAll((elements) => {
      for (const element of elements) {
        const animation = element.getAnimations()[0];
        if (!animation) throw new Error('Expected CSS animation for guidance');
        animation.play();
      }
    });
  await activate(page, 'Начать', isMobile);
  await checkScreen(page, 'Карта занятий');
  await activate(page, 'Начать демонстрационное занятие', isMobile);
  await checkScreen(page, 'Найди такой же');
  const answers = page.getByRole('group');
  const appearances = await answers
    .getByRole('button')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          shadow: style.boxShadow,
          animation: style.animationName,
          border: style.borderColor,
        };
      }),
    );
  expect(appearances).toHaveLength(3);
  expect(appearances[1]).toEqual(appearances[0]);
  expect(appearances[2]).toEqual(appearances[0]);
  for (const name of [
    'Синий круг без точки',
    'Синий круг с жёлтым квадратом',
  ]) {
    await activate(page, name, isMobile);
    await checkScreen(page, 'Попробуй ещё');
    await expect(guide).toHaveAttribute('data-guide-target', 'answers');
    const correct = page.getByRole('button', {
      name: 'Синий круг с жёлтой точкой',
      exact: true,
    });
    expect(
      await correct.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe('none');
    expect(
      await correct.evaluate((element) => getComputedStyle(element).boxShadow),
    ).toBe('none');
    const mistaken = page.getByRole('button', { name, exact: true });
    expect(
      await mistaken.evaluate(
        (element) => getComputedStyle(element).borderStyle,
      ),
    ).toBe('dashed');
    expect(
      await mistaken
        .locator('.composite')
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe('mistake-shake');
  }
  await activate(page, 'Синий круг с жёлтой точкой', isMobile);
  await checkScreen(page, 'Верно!');
  await activate(page, 'Дальше', isMobile);
  await checkScreen(page, 'Занятие завершено!');
});
