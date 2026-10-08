import { expect, test, type Page } from '@playwright/test';
import { timeline, timings } from '../../src/app/timings';

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

async function checkPersikGeometry(page: Page) {
  const cat = page.locator('.persik img');
  await expect(cat).toBeVisible();
  await expect(cat).toHaveAttribute('alt', '');
  await expect(page.locator('.persik')).toHaveAttribute('aria-hidden', 'true');
  const dimensions = await cat.evaluate((image: HTMLImageElement) => ({
    loaded: image.complete,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  expect(dimensions).toEqual({ loaded: true, width: 512, height: 724 });
  await expect(cat).toHaveCSS('pointer-events', 'none');
  const catBox = (await cat.boundingBox())!;
  // Both dimensions stay below the source size, even on a 2x display.
  expect(catBox.width * 2).toBeLessThan(512);
  expect(catBox.height * 2).toBeLessThan(724);
  for (const element of await page
    .locator('button, h1, .instruction, .sample, .answers, .celebration')
    .all()) {
    const box = (await element.boundingBox())!;
    const overlaps =
      catBox.x < box.x + box.width &&
      catBox.x + catBox.width > box.x &&
      catBox.y < box.y + box.height &&
      catBox.y + catBox.height > box.y;
    expect(
      overlaps,
      `Persik overlaps ${await element.getAttribute('class')}`,
    ).toBe(false);
  }
}

async function checkScreen(page: Page, title: string) {
  await expect(
    page.getByRole('heading', { level: 1, name: title, exact: true }),
  ).toBeVisible();
  const navigation = [
    'Логические последовательности 4–5',
    'Карта занятий',
    'Занятие завершено!',
  ].includes(title);
  await expect(page.locator('.action-guide')).toHaveCount(0);
  await expect(page.locator('.persik')).toHaveCount(1);
  if (navigation) {
    const guide = page.locator('.persik-guide');
    await expect(guide).toHaveCount(1);
    await expect(guide).toHaveAttribute('data-direction', 'right');
    const target = page.locator('.next-action > button');
    await expect(target).toBeVisible();
    await expect(target).toHaveAccessibleName(/.+/);
    await expect(page.locator('.guided-action')).toHaveCount(1);
    const catBox = (await guide.boundingBox())!;
    const targetBox = (await target.boundingBox())!;
    // The approved paw points right, at about 44% of the image height.
    const pawY = catBox.y + catBox.height * 0.44;
    expect(catBox.x + catBox.width).toBeLessThan(targetBox.x);
    expect(pawY).toBeGreaterThan(targetBox.y);
    expect(pawY).toBeLessThan(targetBox.y + targetBox.height);
    const reduced = await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    await expect(guide.locator('img')).toHaveCSS(
      'animation-name',
      reduced ? 'none' : 'persik-guide',
    );
  } else {
    await expect(
      page.locator('.persik-guide, .persik[data-direction]'),
    ).toHaveCount(0);
    await expect(page.locator('.guided-action')).toHaveCount(0);
  }
  await checkPersikGeometry(page);
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
  await page.clock.runFor(timings.navigationLock);
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
    .locator(
      '.sample, .sample > .composite, .sample .inner, .answers, .repeat-instruction',
    )
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
    'task-appear',
    'task-appear',
    'answer-appear',
    'task-appear',
  ]);
  expect(styles.map((style) => style.delay)).toEqual([
    timeline.sampleFrame,
    timeline.sampleCircle,
    timeline.sampleDot,
    timeline.answers,
    timeline.instruction,
  ]);
  expect(
    styles.every(
      (style) =>
        style.easing === 'ease-out' &&
        style.delay + style.duration <= timeline.entrance,
    ),
  ).toBe(true);
  await expect(page.locator('.task-arriving')).toHaveCSS(
    'animation-duration',
    '0.35s',
  );
  expect(styles[1]!.delay - styles[0]!.delay).toBe(225);
  expect(styles[2]!.delay - styles[1]!.delay).toBe(225);
  expect(styles[3]!.delay - (styles[2]!.delay + styles[2]!.duration)).toBe(400);
  expect(styles[3]!.duration).toBe(400);
  expect(styles[0]!.frames[0]!.transform).toBe('scale(0.85)');
  expect(styles[3]!.frames[0]!.transform).toBe('translateY(16px)');
  await animationPhase(page, timeline.answers - 1);
  await expect(page.locator('.sample .inner')).toHaveCSS('opacity', '1');
  await expect(page.locator('.answers')).toHaveCSS('opacity', '0');
  await animationPhase(page, timeline.answers + timings.answers);
  await expect(page.locator('.answers')).toHaveCSS('opacity', '1');
  await expect(page.locator('.answer')).toHaveCount(3);
  for (const answer of await page.locator('.answer').all())
    await expect(answer).toBeDisabled();
  const box = (await page
    .getByRole('button', { name: correct, exact: true })
    .boundingBox())!;
  if (isMobile)
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.clock.runFor(timeline.entrance - 1);
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
  await page.clock.runFor(timeline.entrance);
  await ready(page);
  await page
    .locator('.sample')
    .evaluate((element) => element.setAttribute('data-preserved', 'yes'));
  for (const name of [wrong, wrong, 'Синий круг с жёлтым квадратом']) {
    await activate(page, name, isMobile);
    await expect(task(page)).toHaveAttribute('data-phase', 'press');
    await expect(page.locator('.mistaken')).toHaveCSS(
      'animation-name',
      'mistake-shake',
    );
    await expect(page.locator('.mistaken')).toHaveCSS(
      'animation-duration',
      '0.45s',
    );
    await page.clock.runFor(timings.choiceReaction);
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
    await page.clock.runFor(timings.retry - timings.choiceReaction - 1);
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
  await expect(page.locator('audio, video, canvas')).toHaveCount(0);
});

test('успех награждает и переходит один раз, двойной ввод не пропускает состояния', async ({
  page,
  isMobile,
}) => {
  await frozenTask(page, isMobile);
  await page.clock.runFor(timeline.entrance);
  await ready(page);
  const answer = page.getByRole('button', { name: correct, exact: true });
  const box = (await answer.boundingBox())!;
  if (isMobile) {
    await answer.tap();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else await answer.dblclick();
  await expect(task(page)).toHaveAttribute('data-phase', 'press');
  await page.clock.runFor(timings.choiceReaction);
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
  await expect(page.locator('.particle').first()).toHaveCSS(
    'animation-delay',
    '0.275s',
  );
  await expect(page.locator('.particle').first()).toHaveCSS(
    'animation-duration',
    '1.8s',
  );
  await expect(page.locator('.won')).toHaveCSS('animation-duration', '0.45s');
  const scales = await page.locator('.won').evaluate((element) => {
    const effect = element.getAnimations()[0]?.effect;
    return effect instanceof KeyframeEffect
      ? effect
          .getKeyframes()
          .map((frame) => new DOMMatrix(String(frame.transform)).m11)
      : [];
  });
  expect(Math.min(...scales)).toBeCloseTo(0.95, 5);
  expect(Math.max(...scales)).toBeCloseTo(1.1, 5);
  await expect(page.getByRole('button', { name: 'Дальше' })).toHaveCount(0);
  await page.clock.runFor(
    timings.confettiDelay + timings.confetti - timings.choiceReaction,
  );
  await expect(task(page)).toHaveAttribute('data-phase', 'success');
  await page.clock.runFor(timings.resultHold - 1);
  await expect(task(page)).toHaveAttribute('data-phase', 'success');
  await page.clock.runFor(1);
  await expect(task(page)).toHaveAttribute('data-phase', 'leaving');
  await expect(page.locator('.leaving')).toHaveCSS(
    'animation-name',
    'task-disappear',
  );
  await expect(page.locator('.leaving')).toHaveCSS(
    'animation-duration',
    '0.2s',
  );
  await page.clock.runFor(timings.completeTransition / 2);
  await checkScreen(page, 'Занятие завершено!');
  await expect(page.locator('.complete-arriving')).toHaveCSS(
    'animation-duration',
    '0.2s',
  );
  await page.clock.runFor(timings.navigationLock);
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
  await page.clock.runFor(timings.reducedSuccess - 1);
  await expect(task(page)).toHaveAttribute('data-phase', 'success');
  await page.clock.runFor(1);
  await checkScreen(page, 'Занятие завершено!');
  await expect(page.locator('.persik-guide img')).toHaveCSS(
    'animation-name',
    'none',
  );
  await page.clock.runFor(timings.navigationLock);
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
  await frozen(page);
  await checkScreen(page, 'Логические последовательности 4–5');
  await animationPhase(page, timings.guideCycle / 2);
  await capture('00-welcome');
  await activate(page, 'Начать', isMobile);
  await page.clock.runFor(timings.navigationLock);
  await checkScreen(page, 'Карта занятий');
  await animationPhase(page, timings.guideCycle / 2);
  await capture('00-map');
  await activate(page, lesson, isMobile);
  await animationPhase(page, timeline.sampleDot - 25);
  await capture('01-task-entrance');
  await page.clock.runFor(timeline.entrance);
  await ready(page);
  await checkScreen(page, 'Найди такой же');
  await capture('02-task-ready');
  await activate(page, wrong, isMobile);
  await page.clock.runFor(timings.choiceReaction);
  await animationPhase(page, 225);
  await capture('03-incorrect');
  await checkScreen(page, 'Попробуй ещё');
  await page.clock.runFor(timings.retry - timings.choiceReaction);
  await activate(page, correct, isMobile);
  await page.clock.runFor(timings.choiceReaction);
  await animationPhase(page, timings.choiceReaction, 0);
  await capture('04-success-before-confetti');
  const before = await page.locator('.matching').boundingBox();
  await animationPhase(page, timings.confettiDelay + timings.confetti / 2);
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
  await page.clock.runFor(timeline.leave - timings.choiceReaction);
  await page.clock.runFor(timings.completeTransition / 2);
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
  await page.clock.runFor(timings.navigationLock);
  await activate(page, 'Ещё раз', isMobile);
  await expect(task(page)).toHaveAttribute('data-phase', 'entrance');
  await expect(
    page.locator('.celebration, .mistaken, .won, .muted'),
  ).toHaveCount(0);
  await page.clock.runFor(timeline.entrance);
  await ready(page);
});
test('Персик мягко указывает на кнопку, нажатие на изображение не запускает переход', async ({
  page,
}) => {
  const cat = page.locator('.persik-guide img');
  const start = page.getByRole('button', { name: 'Начать', exact: true });
  const buttonBefore = await start.boundingBox();
  const positions = [];
  for (const time of [0, timings.guideCycle / 2]) {
    await cat.evaluate((element, time) => {
      const animation = element.getAnimations()[0]!;
      animation.pause();
      animation.currentTime = time;
    }, time);
    positions.push((await cat.boundingBox())!);
    await checkScreen(page, 'Логические последовательности 4–5');
  }
  expect(positions[1]!.x).toBeGreaterThan(positions[0]!.x);
  expect(positions[1]!.x - positions[0]!.x).toBeLessThan(10);
  expect(await start.boundingBox()).toEqual(buttonBefore);
  const box = positions[1]!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await checkScreen(page, 'Логические последовательности 4–5');
});

test('все пять неизменённых прототипных ассетов загружаются', async ({
  page,
}) => {
  for (const state of ['idle', 'guide', 'thinking', 'encourage', 'celebrate']) {
    const response = await page.request.get(
      `/assets/persik/persik-${state}.png`,
    );
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
    const dimensions = await page.evaluate(async (state) => {
      const image = new Image();
      image.src = `/assets/persik/persik-${state}.png`;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, state);
    expect(dimensions).toEqual([512, 724]);
  }
});

test('спокойный Персик не двигается и не меняет положение при выборе любого ответа', async ({
  page,
  isMobile,
}) => {
  await frozenTask(page, isMobile);
  await expect(page.locator('.persik')).toHaveAttribute(
    'data-persik-state',
    'idle',
  );
  await expect(page.locator('.persik img')).toHaveCSS('animation-name', 'none');
  await page.clock.runFor(timeline.entrance);
  await ready(page);
  const initialBox = await page.locator('.persik').boundingBox();
  for (const name of [wrong, 'Синий круг с жёлтым квадратом']) {
    await activate(page, name, isMobile);
    await expect(page.locator('.persik')).toHaveAttribute(
      'data-persik-state',
      'encourage',
    );
    expect(await page.locator('.persik').boundingBox()).toEqual(initialBox);
    await checkScreen(page, 'Попробуй ещё');
    await page.clock.runFor(timings.choiceReaction);
    await page.clock.runFor(timings.retry - timings.choiceReaction);
    await ready(page);
    await expect(page.locator('.persik')).toHaveAttribute(
      'data-persik-state',
      'idle',
    );
    await expect(page.locator('.persik img')).toHaveCSS(
      'animation-name',
      'none',
    );
    expect(await page.locator('.persik').boundingBox()).toEqual(initialBox);
  }
  await activate(page, correct, isMobile);
  await expect(page.locator('.persik')).toHaveAttribute(
    'data-persik-state',
    'celebrate',
  );
  expect(await page.locator('.persik').boundingBox()).toEqual(initialBox);
  await expect(page.locator('.persik img')).toHaveCSS(
    'animation-delay',
    '0.275s',
  );
  await checkScreen(page, 'Верно!');
});

test('reduced motion оставляет Персика статичным на навигации, задании и после ошибки', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await frozen(page);
  async function staticCat(title: string, state: string) {
    await checkScreen(page, title);
    await expect(page.locator('.persik')).toHaveAttribute(
      'data-persik-state',
      state,
    );
    await expect(page.locator('.persik img')).toHaveCSS(
      'animation-name',
      'none',
    );
    await expect(page.locator('.persik img')).toHaveCSS('transform', 'none');
    expect(
      await page
        .locator('.persik img')
        .evaluate((element) => element.getAnimations().length),
    ).toBe(0);
  }
  await staticCat('Логические последовательности 4–5', 'guide');
  await activate(page, 'Начать', isMobile);
  await staticCat('Карта занятий', 'guide');
  await page.clock.runFor(timings.navigationLock);
  await activate(page, lesson, isMobile);
  await staticCat('Найди такой же', 'idle');
  await activate(page, wrong, isMobile);
  await page.clock.runFor(0);
  await staticCat('Попробуй ещё', 'encourage');
  await page.clock.runFor(timings.retry - 1);
  await expect(page.locator('.answer').first()).toBeDisabled();
  await page.clock.runFor(1);
  await ready(page);
  await staticCat('Попробуй ещё', 'idle');
  await activate(page, correct, isMobile);
  await page.clock.runFor(0);
  await staticCat('Верно!', 'celebrate');
  await page.clock.runFor(timings.reducedSuccess);
  await staticCat('Занятие завершено!', 'guide');
});
