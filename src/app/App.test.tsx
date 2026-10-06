import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const correct = 'Синий круг с жёлтой точкой';
const wrong = 'Синий круг без точки';
const otherWrong = 'Синий круг с жёлтым квадратом';
const lesson = 'Начать демонстрационное занятие';

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
  act(() => vi.advanceTimersByTime(500));
}
function openTask() {
  click('Начать');
  click(lesson);
}
function expectGuide(target: HTMLElement) {
  const guides = document.querySelectorAll('.action-guide');
  expect(guides).toHaveLength(1);
  expect(guides[0]).toHaveAttribute('aria-hidden', 'true');
  expect(guides[0]).toHaveAttribute('data-guide-target', target.id);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Демонстрационный детский сценарий W02', () => {
  it('начинается с одной кнопки с понятным именем без ввода данных', () => {
    render(<App />);
    expect(screen.getByRole('heading')).toHaveFocus();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expectGuide(screen.getByRole('button', { name: 'Начать' }));
  });

  it('показывает ровно один указатель на каждом переходе и возвращается на карту', () => {
    render(<App />);
    for (const name of ['Начать', lesson, correct, 'Дальше', 'На карту']) {
      const action = screen.getByRole('button', { name });
      if (name !== correct) {
        expectGuide(action);
        expect(action).toHaveClass('guided-action');
        expect(action).toHaveAccessibleName(name);
      }
      click(name);
      expect(screen.getByRole('heading')).toHaveFocus();
    }
    expect(
      screen.getByRole('heading', { name: 'Карта занятий' }),
    ).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('содержит три структурно различных ответа и отделённый образец', () => {
    render(<App />);
    openTask();
    const answers = screen.getByRole('group', {
      name: 'Выбери такую же фигуру',
    });
    expect(within(answers).getAllByRole('button')).toHaveLength(3);
    const sample = screen.getByRole('img', {
      name: 'Образец: синий круг с жёлтой точкой',
    });
    expect(answers).not.toContainElement(sample);
    expect(sample.querySelector('.dot')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: correct }).querySelector('.dot'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: wrong }).querySelector('.inner'),
    ).toBeNull();
    expect(
      screen
        .getByRole('button', { name: otherWrong })
        .querySelector('.inner.square'),
    ).toBeInTheDocument();
  });

  it('повторные ошибки оставляют все ответы доступными и указывают на группу', () => {
    render(<App />);
    openTask();
    for (const name of [wrong, wrong, otherWrong, otherWrong]) {
      // No timer advance: an incorrect choice must not lock the answers.
      fireEvent.click(screen.getByRole('button', { name }));
      expect(
        screen.getByRole('heading', { name: 'Попробуй ещё' }),
      ).toBeVisible();
      const answers = screen.getByRole('group');
      expectGuide(answers);
      expect(answers.closest('.matching')).toHaveClass('highlighted');
      for (const answer of within(answers).getAllByRole('button')) {
        expect(answer).toBeEnabled();
        expect(answer).not.toHaveClass('guided-action');
      }
      expect(screen.getByRole('button', { name })).toHaveClass('mistaken');
      expect(screen.getByRole('button', { name: correct })).not.toHaveClass(
        'mistaken',
      );
    }
    expect(screen.getByRole('status')).toHaveTextContent('Попытка 4');
    click(correct);
    expect(screen.getByRole('status')).toHaveTextContent('Получилось!');
    expect(document.querySelector('.success-mark')).toHaveTextContent('✓');
    expectGuide(screen.getByRole('button', { name: 'Дальше' }));
  });

  it('повторяет визуальную инструкцию и сбрасывает помощь при новом запуске', () => {
    render(<App />);
    openTask();
    click('Повторить инструкцию');
    expect(
      screen.getByText('Посмотри на образец. Найди такой же.'),
    ).toHaveFocus();
    expect(document.querySelector('.matching')).toHaveClass('highlighted');
    click(correct);
    click('Дальше');
    const home = screen.getByRole('button', { name: 'На карту' });
    expect(home).toHaveClass('primary', 'guided-action');
    expect(home.querySelector('.home-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ещё раз' })).toHaveClass(
      'secondary',
    );
    click('Ещё раз');
    expect(document.querySelector('.matching')).not.toHaveClass('highlighted');
    expect(screen.getByRole('heading')).toHaveFocus();
  });

  it('игнорирует быстрый переход, двойной клик и автоповтор клавиши', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
    const next = screen.getByRole('button', { name: lesson });
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(
      screen.getByRole('heading', { name: 'Карта занятий' }),
    ).toBeVisible();
    act(() => vi.advanceTimersByTime(500));
    fireEvent.click(next, { detail: 2 });
    expect(
      screen.getByRole('heading', { name: 'Карта занятий' }),
    ).toBeVisible();
    expect(fireEvent.keyDown(next, { key: 'Enter', repeat: true })).toBe(false);
    click(lesson);
    expect(
      screen.getByRole('heading', { name: 'Найди такой же' }),
    ).toBeVisible();
  });
});
