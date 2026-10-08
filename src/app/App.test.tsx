import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { timeline, timings } from './timings';

const correct = 'Синий круг с жёлтой точкой';
const wrong = 'Синий круг без точки';
const otherWrong = 'Синий круг с жёлтым квадратом';
const lesson = 'Начать демонстрационное занятие';
const button = (name: string) => screen.getByRole('button', { name });
const advance = (time: number) => act(() => vi.advanceTimersByTime(time));
const choose = (name: string) => fireEvent.click(button(name));
const phase = () =>
  document.querySelector('.task-content')?.getAttribute('data-phase');
function openTask(ready = true) {
  choose('Начать');
  advance(timings.navigationLock);
  choose(lesson);
  if (ready) advance(timeline.entrance);
}
function complete() {
  choose(correct);
  advance(timings.choiceReaction);
  advance(timeline.leave - timings.choiceReaction);
  advance(timings.completeTransition / 2);
  advance(timings.navigationLock);
}
function expectOptions(enabled: boolean) {
  const options = within(screen.getByRole('group')).getAllByRole('button');
  expect(options).toHaveLength(3);
  for (const option of options) {
    if (enabled) expect(option).toBeEnabled();
    else expect(option).toBeDisabled();
  }
}
function expectGuide(name: string) {
  const guides = document.querySelectorAll('.persik-guide');
  expect(guides).toHaveLength(1);
  expect(guides[0]).toHaveAttribute('aria-hidden', 'true');
  expect(guides[0]).toHaveAttribute('data-direction', 'right');
  expect(guides[0]!.parentElement).toContainElement(button(name));
  expect(document.querySelector('.action-guide')).toBeNull();
  expect(button(name)).toHaveAccessibleName(name);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Игровая петля W02', () => {
  it('соблюдает наблюдаемый темп и общий бюджет анимаций', () => {
    expect(timings.shell).toBeGreaterThanOrEqual(300);
    expect(timings.shell).toBeLessThanOrEqual(400);
    expect(timings.samplePart).toBeGreaterThanOrEqual(200);
    expect(timings.samplePart).toBeLessThanOrEqual(250);
    expect(timings.afterSample).toBe(400);
    expect(timings.answers).toBeGreaterThanOrEqual(350);
    expect(timings.answers).toBeLessThanOrEqual(450);
    expect(timeline.entrance).toBeLessThanOrEqual(2500);
    expect(timeline.completeVisible).toBeGreaterThanOrEqual(2700);
    expect(timeline.completeVisible).toBeLessThanOrEqual(3000);
    expect(timings.reducedSuccess).toBeGreaterThanOrEqual(1500);
    expect(timings.reducedSuccess).toBeLessThanOrEqual(2000);
  });
  it('сохраняет утверждённые задержки W02 без изменений', () => {
    expect(timings).toEqual({
      navigationLock: 500,
      guideCycle: 950,
      shell: 350,
      samplePart: 225,
      afterSample: 400,
      answers: 400,
      instruction: 225,
      choiceReaction: 450,
      retry: 800,
      confettiDelay: 275,
      confetti: 1800,
      resultHold: 500,
      completeTransition: 400,
      reducedSuccess: 1750,
    });
  });
  it('приветствие предлагает одно доступное действие без ввода данных', () => {
    render(<App />);
    expect(screen.getByRole('heading')).toHaveFocus();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expectGuide('Начать');
  });
  it('Персик указывает только на основное действие навигационных экранов', () => {
    render(<App />);
    choose('Начать');
    advance(timings.navigationLock);
    expectGuide(lesson);
    choose(lesson);
    advance(timeline.entrance);
    expect(document.querySelector('.action-guide')).toBeNull();
    complete();
    expectGuide('На карту');
    choose('На карту');
    advance(timings.navigationLock);
    expectGuide(lesson);
  });
  it('начинает task в entrance-состоянии и блокирует все ответы', () => {
    render(<App />);
    openTask(false);
    expect(phase()).toBe('entrance');
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'idle',
    );
    expectOptions(false);
    expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
  });
  it('открывает все три ответа одновременно после entrance', () => {
    render(<App />);
    openTask(false);
    advance(timeline.entrance - 1);
    expectOptions(false);
    advance(1);
    expectOptions(true);
    expect(phase()).toBe('ready');
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'idle',
    );
  });
  it('игнорирует преждевременный ввод во время entrance', () => {
    render(<App />);
    openTask(false);
    choose(correct);
    choose(wrong);
    advance(timeline.entrance);
    expect(phase()).toBe('ready');
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'idle',
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Найди такой же');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('содержит три структурно различных ответа и отдельный образец', () => {
    render(<App />);
    openTask();
    const answers = screen.getByRole('group');
    expectOptions(true);
    const sample = screen.getByRole('img', {
      name: 'Образец: синий круг с жёлтой точкой',
    });
    expect(answers).not.toContainElement(sample);
    expect(sample.querySelector('.dot')).toBeInTheDocument();
    expect(button(correct).querySelector('.dot')).toBeInTheDocument();
    expect(button(wrong).querySelector('.inner')).toBeNull();
    expect(
      button(otherWrong).querySelector('.inner.square'),
    ).toBeInTheDocument();
    for (const option of within(answers).getAllByRole('button'))
      expect(option).toHaveClass('answer', { exact: true });
  });
  it('сразу реагирует на выбор и блокирует повторный ввод', () => {
    render(<App />);
    openTask();
    choose(wrong);
    expect(phase()).toBe('press');
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'encourage',
    );
    expect(button(wrong)).toHaveClass('mistaken');
    expectOptions(false);
    choose(correct);
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'encourage',
    );
    advance(timings.choiceReaction);
    expect(phase()).toBe('error');
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'encourage',
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Попробуй ещё');
  });
  it('реагирует на ошибку без раскрытия правильного ответа и без замены образца', () => {
    render(<App />);
    openTask();
    const sample = screen.getByRole('img');
    choose(wrong);
    advance(timings.choiceReaction);
    expect(button(wrong)).toHaveClass('mistaken');
    expect(button(correct)).toHaveClass('answer', { exact: true });
    expect(document.querySelector('.action-guide')).toBeNull();
    expect(screen.getByRole('img')).toBe(sample);
    expectOptions(false);
  });
  it('снимает реакцию и открывает ответы через 800 мс от выбора', () => {
    render(<App />);
    openTask();
    choose(wrong);
    advance(timings.choiceReaction);
    advance(timings.retry - timings.choiceReaction - 1);
    expectOptions(false);
    advance(1);
    expectOptions(true);
    expect(phase()).toBe('ready');
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'idle',
    );
    expect(button(wrong)).not.toHaveClass('mistaken');
  });
  it('повторяет реакцию на каждую ошибку без тупика', () => {
    render(<App />);
    openTask();
    for (const name of [wrong, wrong, otherWrong, otherWrong]) {
      choose(name);
      advance(timings.choiceReaction);
      expect(button(name)).toHaveClass('mistaken');
      advance(timings.retry - timings.choiceReaction);
      expectOptions(true);
    }
    expect(screen.getByRole('status')).toHaveTextContent(
      'Попробуй ещё. Попытка 4.',
    );
  });
  it('правильный выбор включает success-состояние и выделяет только выбранный ответ', () => {
    render(<App />);
    openTask();
    choose(correct);
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'celebrate',
    );
    advance(timings.choiceReaction);
    expect(phase()).toBe('success');
    expectOptions(false);
    expect(button(correct)).toHaveClass('won');
    expect(button(wrong)).toHaveClass('muted');
    expect(document.querySelector('.success-mark')).toHaveTextContent('✓');
  });
  it('показывает 20 скрытых от accessibility частиц локальной награды', () => {
    render(<App />);
    openTask();
    choose(correct);
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'celebrate',
    );
    advance(timings.choiceReaction);
    const celebration = document.querySelector('.celebration');
    expect(celebration).toHaveAttribute('aria-hidden', 'true');
    expect(celebration?.querySelectorAll('.particle')).toHaveLength(20);
  });
  it('не требует кнопки Дальше и автоматически завершает после награды, выдержки и плавного перехода', () => {
    render(<App />);
    openTask();
    choose(correct);
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'celebrate',
    );
    advance(timings.choiceReaction);
    expect(
      screen.queryByRole('button', { name: 'Дальше' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('.action-guide')).toBeNull();
    advance(timings.confettiDelay + timings.confetti - timings.choiceReaction);
    expect(phase()).toBe('success');
    advance(timings.resultHold - 1);
    expect(phase()).toBe('success');
    advance(1);
    expect(phase()).toBe('leaving');
    expectOptions(false);
    advance(timings.completeTransition / 2 - 1);
    expect(phase()).toBe('leaving');
    advance(1);
    expect(screen.getByRole('heading')).toHaveTextContent('Занятие завершено!');
  });
  it('двойной ввод запускает только один автоматический переход', () => {
    render(<App />);
    openTask();
    choose(correct);
    const celebratingImage = document.querySelector('.persik-celebrate img');
    choose(correct);
    fireEvent.click(button(correct), { detail: 2 });
    expect(document.querySelector('.persik-celebrate img')).toBe(
      celebratingImage,
    );
    advance(timings.choiceReaction);
    expect(vi.getTimerCount()).toBe(1);
    expect(document.querySelectorAll('.persik-celebrate')).toHaveLength(1);
    advance(timeline.leave - timings.choiceReaction);
    advance(timings.completeTransition / 2);
    advance(timings.navigationLock);
    expect(vi.getTimerCount()).toBe(0);
    choose('На карту');
    advance(10000);
    expect(screen.getByRole('heading')).toHaveTextContent('Карта занятий');
  });
  it('повтор сбрасывает награду, ошибку и снова запускает entrance', () => {
    render(<App />);
    openTask();
    choose(wrong);
    advance(timings.choiceReaction);
    advance(timings.retry - timings.choiceReaction);
    complete();
    choose('Ещё раз');
    expect(phase()).toBe('entrance');
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'idle',
    );
    expectOptions(false);
    expect(document.querySelector('.celebration')).toBeNull();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    advance(timeline.entrance);
    expectOptions(true);
    for (const name of [correct, wrong, otherWrong])
      expect(button(name)).toHaveClass('answer', { exact: true });
  });
  it('повтор инструкции выделяет образец и группу, сохраняя равноправие ответов', () => {
    render(<App />);
    openTask();
    choose('Повторить инструкцию');
    expect(document.querySelector('.matching')).toHaveClass('highlighted');
    expect(
      screen.getByText('Посмотри на образец. Найди такой же.'),
    ).toHaveFocus();
    expect(document.querySelector('.action-guide')).toBeNull();
    expectOptions(true);
  });
  it('reduced motion открывает задание сразу и завершает без частиц через 1750 мс', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<App />);
    openTask(false);
    expect(phase()).toBe('ready');
    expect(document.querySelector('.persik')).toHaveAttribute(
      'data-persik-state',
      'idle',
    );
    expectOptions(true);
    choose(correct);
    advance(0);
    expect(phase()).toBe('success');
    expect(document.querySelector('.celebration')).toBeNull();
    expect(button(correct)).toHaveClass('won');
    advance(timings.reducedSuccess - 1);
    expect(phase()).toBe('success');
    advance(1);
    expect(screen.getByRole('heading')).toHaveTextContent('Занятие завершено!');
  });
  it('подавляет автоповтор Enter и Space', () => {
    render(<App />);
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', {
        key,
        repeat: true,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(button('Начать'), event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(screen.getByRole('heading')).toHaveTextContent(
      'Логические последовательности',
    );
  });
  it.each([
    'idle',
    'entrance',
    'press',
    'error',
    'success',
    'leaving',
  ] as const)('очищает таймер %s при unmount', (state) => {
    const { unmount } = render(<App />);
    if (state !== 'idle') openTask(state !== 'entrance');
    if (state !== 'entrance' && state !== 'idle')
      choose(state === 'success' || state === 'leaving' ? correct : wrong);
    if (state === 'error' || state === 'success' || state === 'leaving')
      advance(timings.choiceReaction);
    if (state === 'leaving') advance(timeline.leave - timings.choiceReaction);
    if (state !== 'idle') expect(phase()).toBe(state);
    advance(0);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(10000);
  });
});
