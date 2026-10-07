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
  const navigation = [
    'Логические последовательности 4–5',
    'Карта занятий',
    'Занятие завершено!',
  ].includes(title);
  if (navigation) {
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
  } else {
    await expect(guide).toHaveCount(0);
    await expect(page.locator('.guided-action')).toHaveCount(0);
  }
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

const correct = 'Синий круг с жёлтой точкой';
const wrong = 'Синий круг без точки';
const lesson = 'Начать демонстрационное занятие';
const task = (page: Page) => page.locator('.task-content');
async function ready(page: Page) {
  await expect(task(page)).toHaveAttribute('data-phase', 'ready');
  for (const answer of await page.locator('.answer').all())
    await expect(answer).toBeEnabled();
}
async function frozen(page: Page) {
  await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-07T12:00:01Z'));
  await page.reload();
}
async function frozenTask(page: Page, touch: boolean) {
  await frozen(page);
  await activate(page, 'Начать', touch);
  await page.clock.runFor(500);
  await activate(page, lesson, touch);
}
async function animationPhase(page: Page, time: number, particleTime = time) {
  await page.locator('.panel, .panel *').evaluateAll(
    (elements, times) => {
      for (const element of elements)
        for (const animation of element.getAnimations()) {
          animation.pause();
          animation.currentTime = element.classList.contains('particle')
            ? times.particleTime
            : times.time;
        }
    },
    { time, particleTime },
  );
}

test('полный путь, автоматическое завершение, возврат и повтор', async ({
  page,
  isMobile,
}) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await checkScreen(page, 'Логические последовательности 4–5');
  await openTask(page, isMobile);
  await ready(page);
  await activate(page, correct, isMobile);
  await checkScreen(page, 'Верно!');
  await expect(page.locator('.success-mark')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Дальше' })).toHaveCount(0);
  await checkScreen(page, 'Занятие завершено!');
  await activate(page, 'На карту', isMobile);
  await checkScreen(page, 'Карта занятий');
  await activate(page, lesson, isMobile);
  await ready(page);
  await activate(page, correct, isMobile);
  await checkScreen(page, 'Занятие завершено!');
  await activate(page, 'Ещё раз', isMobile);
  await ready(page);
  await expect(
    page.locator('.celebration, .mistaken, .won, .muted'),
  ).toHaveCount(0);
  await expect(page.getByRole('status')).toBeEmpty();
});

test('entrance собирает образец и варианты последовательно и игнорирует ранний ввод', async ({
  page,
  isMobile,
}) => {
  await frozenTask(page, isMobile);
  await expect(task(page)).toHaveAttribute('data-phase', 'entrance');
  const styles = await page
    .locator('.sample, .answer, .repeat-instruction')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        const animation = element.getAnimations()[0];
        return {
          name: style.animationName,
          delay: parseFloat(style.animationDelay) * 1000,
          duration: parseFloat(style.animationDuration) * 1000,
          easing: style.animationTimingFunction,
          frames:
            animation?.effect instanceof KeyframeEffect
              ? animation.effect.getKeyframes().map((frame) => ({
                  opacity: frame.opacity,
                  transform: frame.transform,
                }))
              : [],
        };
      }),
    );
  expect(styles.map((style) => style.name)).toEqual([
    'sample-appear',
    'answer-appear',
    'answer-appear',
    'answer-appear',
    'task-appear',
  ]);
  expect(styles.map((style) => style.delay)).toEqual([100, 240, 350, 460, 700]);
  expect(
    styles.every(
      (style) =>
        style.easing === 'ease-out' && style.delay + style.duration <= 800,
    ),
  ).toBe(true);
  expect(styles[0]!.frames[0]!.transform).toBe('scale(0.85)');
  expect(styles[1]!.frames[0]!.transform).toBe('translateY(16px)');
  await expect(page.locator('.answer')).toHaveCount(3);
  for (const answer of await page.locator('.answer').all())
    await expect(answer).toBeDisabled();
  const box = (await page
    .getByRole('button', { name: correct, exact: true })
    .boundingBox())!;
  if (isMobile)
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.clock.runFor(799);
  await expect(task(page)).toHaveAttribute('data-phase', 'entrance');
  await page.clock.runFor(1);
  await ready(page);
  await checkScreen(page, 'Найди такой же');
  const looks = await page.locator('.answer').evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return [
        style.opacity,
        style.backgroundColor,
        style.borderColor,
        style.boxShadow,
        style.animationName,
      ];
    }),
  );
  expect(looks[1]).toEqual(looks[0]);
  expect(looks[2]).toEqual(looks[0]);
  expect(looks[0]![4]).toBe('none');
});

test('повторные ошибки дают краткую реакцию без раскрытия ответа и без замены задания', async ({
  page,
  isMobile,
}) => {
  await frozenTask(page, isMobile);
  await page.clock.runFor(800);
  await ready(page);
  await page
    .locator('.sample')
    .evaluate((element) => element.setAttribute('data-preserved', 'yes'));
  for (const name of [wrong, wrong, 'Синий круг с жёлтым квадратом']) {
    await activate(page, name, isMobile);
    await expect(task(page)).toHaveAttribute('data-phase', 'press');
    await expect(page.locator('.pressed')).toHaveCSS(
      'animation-name',
      'choice-press',
    );
    await page.clock.runFor(120);
    await expect(task(page)).toHaveAttribute('data-phase', 'error');
    await checkScreen(page, 'Попробуй ещё');
    await expect(page.locator('.mistaken')).toHaveCSS(
      'animation-name',
      'mistake-shake',
    );
    await expect(page.locator('.mistaken')).toHaveCSS(
      'border-color',
      'rgb(180, 93, 0)',
    );
    await expect(page.locator('.sample')).toHaveAttribute(
      'data-preserved',
      'yes',
    );
    const correctAnswer = page.getByRole('button', {
      name: correct,
      exact: true,
    });
    await expect(correctAnswer).toHaveCSS('box-shadow', 'none');
    await expect(correctAnswer).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.answer')).toHaveCount(3);
    for (const answer of await page.locator('.answer').all())
      await expect(answer).toBeDisabled();
    await page.clock.runFor(449);
    await expect(correctAnswer).toBeDisabled();
    await page.clock.runFor(1);
    await ready(page);
    await expect(page.locator('.mistaken')).toHaveCount(0);
  }
  await expect(page.getByRole('status')).toHaveText('Попробуй ещё. Попытка 3.');
  await activate(page, 'Повторить инструкцию', isMobile);
  await expect(
    page.getByText('Посмотри на образец. Найди такой же.'),
  ).toBeFocused();
  await expect(page.locator('.matching')).toHaveClass(/highlighted/);
  await expect(page.locator('audio, video, img, canvas')).toHaveCount(0);
});

test('успех награждает и переходит один раз, двойной ввод не пропускает состояния', async ({
  page,
  isMobile,
}) => {
  await frozenTask(page, isMobile);
  await page.clock.runFor(800);
  await ready(page);
  const answer = page.getByRole('button', { name: correct, exact: true });
  const box = (await answer.boundingBox())!;
  if (isMobile) {
    await answer.tap();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else await answer.dblclick();
  await expect(task(page)).toHaveAttribute('data-phase', 'press');
  await page.clock.runFor(120);
  await checkScreen(page, 'Верно!');
  await expect(task(page)).toHaveAttribute('data-phase', 'success');
  await expect(page.locator('.won')).toHaveCSS(
    'animation-name',
    'choice-success',
  );
  await expect(page.locator('.won')).toHaveCSS(
    'box-shadow',
    'rgb(49, 94, 75) 0px 0px 0px 5px',
  );
  await expect(page.locator('.muted')).toHaveCount(2);
  await expect(page.locator('.muted').first()).toHaveCSS('opacity', '0.35');
  await expect(page.locator('.celebration')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await expect(page.locator('.celebration')).toHaveCSS('position', 'absolute');
  await expect(page.locator('.celebration')).toHaveCSS(
    'pointer-events',
    'none',
  );
  await expect(page.locator('.particle')).toHaveCount(20);
  await expect(page.locator('.particle').first()).toHaveCSS(
    'animation-name',
    'prize-burst',
  );
  await expect(page.getByRole('button', { name: 'Дальше' })).toHaveCount(0);
  await page.clock.runFor(1199);
  await expect(task(page)).toHaveAttribute('data-phase', 'success');
  await page.clock.runFor(1);
  await checkScreen(page, 'Занятие завершено!');
  await page.clock.runFor(500);
  await activate(page, 'На карту', isMobile);
  await page.clock.runFor(10000);
  await checkScreen(page, 'Карта занятий');
});

test('быстрый повторный ввод не перескакивает с карты к заданию', async ({
  page,
  isMobile,
}) => {
  await frozen(page);
  const start = page.getByRole('button', { name: 'Начать', exact: true });
  if (isMobile) await start.tap();
  else await start.dblclick();
  const next = page.getByRole('button', { name: lesson, exact: true });
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
});

test('полный путь клавиатурой с видимым фокусом', async ({
  page,
  browserName,
}) => {
  const tab =
    browserName === 'webkit' && process.platform === 'darwin'
      ? 'Alt+Tab'
      : 'Tab';
  for (const name of ['Начать', lesson, correct]) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeEnabled();
    await expect(page.getByRole('heading')).toBeFocused();
    await page.keyboard.press(tab);
    await expect(button).toBeFocused();
    expect(
      await button.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      ),
    ).toBe('solid');
    await page.keyboard.press('Enter');
  }
  await checkScreen(page, 'Занятие завершено!');
  const home = page.getByRole('button', { name: 'На карту', exact: true });
  await expect(home).toBeEnabled();
  await expect(page.getByRole('heading')).toBeFocused();
  await page.keyboard.press(tab);
  await expect(home).toBeFocused();
  await page.keyboard.press('Space');
  await checkScreen(page, 'Карта занятий');
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
  await activate(page, wrong, isMobile);
  await checkScreen(page, 'Попробуй ещё');
  await activate(page, correct, isMobile);
  await checkScreen(page, 'Верно!');
  await checkScreen(page, 'Занятие завершено!');
});

test('варианты различаются структурой, образец отделён от ответов', async ({
  page,
  isMobile,
}) => {
  await openTask(page, isMobile);
  await ready(page);
  const answers = page.getByRole('group');
  await expect(answers.getByRole('button')).toHaveCount(3);
  await expect(answers.locator('.dot')).toHaveCount(1);
  await expect(answers.locator('.inner.square')).toHaveCount(1);
  const sample = page.getByRole('img');
  expect(
    await sample.evaluate((element) => element.closest('.answers')),
  ).toBeNull();
  const dot = await answers.locator('.dot').evaluate((element) => ({
    color: getComputedStyle(element).backgroundColor,
    radius: getComputedStyle(element).borderRadius,
  }));
  const square = await answers.locator('.inner.square').evaluate((element) => ({
    color: getComputedStyle(element).backgroundColor,
    radius: getComputedStyle(element).borderRadius,
  }));
  expect(dot.color).toBe(square.color);
  expect(dot.radius).not.toBe(square.radius);
});

test('reduced motion исключает движение и частицы, оставляет рамку и автоматический переход', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await frozenTask(page, isMobile);
  await ready(page);
  await activate(page, correct, isMobile);
  await page.clock.runFor(0);
  await expect(task(page)).toHaveAttribute('data-phase', 'success');
  await expect(page.locator('.celebration, .particle')).toHaveCount(0);
  await expect(page.locator('.success-mark')).toBeVisible();
  await expect(page.locator('.won')).toHaveCSS('transform', 'none');
  await expect(page.locator('.won')).toHaveCSS(
    'box-shadow',
    'rgb(49, 94, 75) 0px 0px 0px 5px',
  );
  const moving = await page
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
  expect(moving).toEqual([]);
  const screenshot = testInfo.outputPath('07-reduced-motion-success.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('reduced-motion-success', {
    path: screenshot,
    contentType: 'image/png',
  });
  await page.clock.runFor(399);
  await expect(task(page)).toHaveAttribute('data-phase', 'success');
  await page.clock.runFor(1);
  await checkScreen(page, 'Занятие завершено!');
  await expect(page.locator('.action-guide')).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(page.locator('.action-guide')).toHaveCSS(
    'color',
    'rgb(255, 176, 0)',
  );
  await page.clock.runFor(500);
  await activate(page, 'Ещё раз', isMobile);
  await ready(page);
  await expect(task(page)).not.toHaveClass(/entering/);
});

test('визуальные доказательства entrance, ошибки, награды и приоритета возврата', async ({
  page,
  isMobile,
}, testInfo) => {
  async function capture(name: string) {
    const screenshot = testInfo.outputPath(`${name}.png`);
    await page.screenshot({
      path: screenshot,
      fullPage: true,
      animations: 'allow',
    });
    await testInfo.attach(name, { path: screenshot, contentType: 'image/png' });
  }
  await frozenTask(page, isMobile);
  await animationPhase(page, 280);
  await capture('01-task-entrance');
  await page.clock.runFor(800);
  await ready(page);
  await checkScreen(page, 'Найди такой же');
  await capture('02-task-ready');
  await activate(page, wrong, isMobile);
  await page.clock.runFor(120);
  await animationPhase(page, 225);
  await capture('03-incorrect');
  await checkScreen(page, 'Попробуй ещё');
  await page.clock.runFor(450);
  await activate(page, correct, isMobile);
  await page.clock.runFor(120);
  await animationPhase(page, 300, 0);
  await capture('04-success-before-confetti');
  const before = await page.locator('.matching').boundingBox();
  await animationPhase(page, 500);
  await capture('05-celebration');
  expect(await page.locator('.matching').boundingBox()).toEqual(before);
  const colors = await page
    .locator('.particle')
    .evaluateAll((elements) => [
      ...new Set(
        elements.map((element) => getComputedStyle(element).backgroundColor),
      ),
    ]);
  expect(colors).toHaveLength(5);
  await page.clock.runFor(1200);
  await animationPhase(page, 475);
  await capture('06-complete');
  await checkScreen(page, 'Занятие завершено!');
  const home = page.getByRole('button', { name: 'На карту', exact: true });
  const repeat = page.getByRole('button', { name: 'Ещё раз', exact: true });
  await expect(home.locator('.home-icon')).toBeVisible();
  await expect(page.locator('.completion-mark')).toBeVisible();
  const homeBox = (await home.boundingBox())!;
  const repeatBox = (await repeat.boundingBox())!;
  expect(homeBox.width * homeBox.height).toBeGreaterThan(
    repeatBox.width * repeatBox.height,
  );
  expect(homeBox.y).toBeLessThan(repeatBox.y);
  await expect(home).toHaveClass(/guided-action/);
  await expect(repeat).not.toHaveClass(/guided-action/);
  await page.clock.runFor(500);
  await activate(page, 'Ещё раз', isMobile);
  await expect(task(page)).toHaveAttribute('data-phase', 'entrance');
  await expect(
    page.locator('.celebration, .mistaken, .won, .muted'),
  ).toHaveCount(0);
  await page.clock.runFor(800);
  await ready(page);
});
test('движется навигационная стрелка, кольцо меняет толщину', async ({
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
});
