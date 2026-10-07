import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

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
  advance(500);
  choose(lesson);
  if (ready) advance(800);
}
function complete() {
  choose(correct);
  advance(120);
  advance(1200);
  advance(500);
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
  const guides = document.querySelectorAll('.action-guide');
  expect(guides).toHaveLength(1);
  expect(guides[0]).toHaveAttribute('aria-hidden', 'true');
  expect(guides[0]).toHaveAttribute('data-guide-target', button(name).id);
  expect(button(name)).toHaveAccessibleName(name);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Игровая петля W02', () => {
  it('приветствие предлагает одно доступное действие без ввода данных', () => {
    render(<App />);
    expect(screen.getByRole('heading')).toHaveFocus();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expectGuide('Начать');
  });
  it('оставляет единственную стрелку только на навигационных экранах', () => {
    render(<App />);
    choose('Начать');
    advance(500);
    expectGuide(lesson);
    choose(lesson);
    advance(800);
    expect(document.querySelector('.action-guide')).toBeNull();
    complete();
    expectGuide('На карту');
    choose('На карту');
    advance(500);
    expectGuide(lesson);
  });
  it('начинает task в entrance-состоянии и блокирует все ответы', () => {
    render(<App />);
    openTask(false);
    expect(phase()).toBe('entrance');
    expectOptions(false);
    expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
  });
  it('открывает все три ответа одновременно после entrance', () => {
    render(<App />);
    openTask(false);
    advance(799);
    expectOptions(false);
    advance(1);
    expectOptions(true);
    expect(phase()).toBe('ready');
  });
  it('игнорирует преждевременный ввод во время entrance', () => {
    render(<App />);
    openTask(false);
    choose(correct);
    choose(wrong);
    advance(800);
    expect(phase()).toBe('ready');
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
    expect(button(wrong)).toHaveClass('pressed');
    expectOptions(false);
    choose(correct);
    advance(120);
    expect(phase()).toBe('error');
    expect(screen.getByRole('heading')).toHaveTextContent('Попробуй ещё');
  });
  it('реагирует на ошибку без раскрытия правильного ответа и без замены образца', () => {
    render(<App />);
    openTask();
    const sample = screen.getByRole('img');
    choose(wrong);
    advance(120);
    expect(button(wrong)).toHaveClass('mistaken');
    expect(button(correct)).toHaveClass('answer', { exact: true });
    expect(document.querySelector('.action-guide')).toBeNull();
    expect(screen.getByRole('img')).toBe(sample);
    expectOptions(false);
  });
  it('снимает реакцию и открывает ответы через 570 мс от выбора', () => {
    render(<App />);
    openTask();
    choose(wrong);
    advance(120);
    advance(449);
    expectOptions(false);
    advance(1);
    expectOptions(true);
    expect(phase()).toBe('ready');
    expect(button(wrong)).not.toHaveClass('mistaken');
  });
  it('повторяет реакцию на каждую ошибку без тупика', () => {
    render(<App />);
    openTask();
    for (const name of [wrong, wrong, otherWrong, otherWrong]) {
      choose(name);
      advance(120);
      expect(button(name)).toHaveClass('mistaken');
      advance(450);
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
    advance(120);
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
    advance(120);
    const celebration = document.querySelector('.celebration');
    expect(celebration).toHaveAttribute('aria-hidden', 'true');
    expect(celebration?.querySelectorAll('.particle')).toHaveLength(20);
  });
  it('не требует кнопки Дальше и автоматически завершает через 1320 мс после выбора', () => {
    render(<App />);
    openTask();
    choose(correct);
    advance(120);
    expect(
      screen.queryByRole('button', { name: 'Дальше' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('.action-guide')).toBeNull();
    advance(1199);
    expect(phase()).toBe('success');
    advance(1);
    expect(screen.getByRole('heading')).toHaveTextContent('Занятие завершено!');
  });
  it('двойной ввод запускает только один автоматический переход', () => {
    render(<App />);
    openTask();
    choose(correct);
    choose(correct);
    fireEvent.click(button(correct), { detail: 2 });
    advance(120);
    expect(vi.getTimerCount()).toBe(1);
    advance(1200);
    advance(500);
    expect(vi.getTimerCount()).toBe(0);
    choose('На карту');
    advance(10000);
    expect(screen.getByRole('heading')).toHaveTextContent('Карта занятий');
  });
  it('повтор сбрасывает награду, ошибку и снова запускает entrance', () => {
    render(<App />);
    openTask();
    choose(wrong);
    advance(120);
    advance(450);
    complete();
    choose('Ещё раз');
    expect(phase()).toBe('entrance');
    expectOptions(false);
    expect(document.querySelector('.celebration')).toBeNull();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    advance(800);
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
  it('reduced motion открывает задание сразу и завершает без частиц через 400 мс', () => {
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
    expectOptions(true);
    choose(correct);
    advance(0);
    expect(phase()).toBe('success');
    expect(document.querySelector('.celebration')).toBeNull();
    expect(button(correct)).toHaveClass('won');
    advance(399);
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
  it.each(['idle', 'entrance', 'press', 'error', 'success'] as const)(
    'очищает таймер %s при unmount',
    (state) => {
      const { unmount } = render(<App />);
      if (state !== 'idle') openTask(state !== 'entrance');
      if (state !== 'entrance' && state !== 'idle')
        choose(state === 'success' ? correct : wrong);
      if (state === 'error' || state === 'success') advance(120);
      if (state !== 'idle') expect(phase()).toBe(state);
      advance(0);
      expect(vi.getTimerCount()).toBe(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      advance(10000);
    },
  );
});
