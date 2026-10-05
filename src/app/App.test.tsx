import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
  act(() => vi.advanceTimersByTime(500));
}

function openTask() {
  click('Начать');
  click('Продолжить');
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Демонстрационный детский сценарий', () => {
  it('начинается с приветствия и одной кнопки без ввода данных', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', {
        name: 'Логические последовательности 4–5',
      }),
    ).toHaveFocus();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('проходит карту, правильный ответ, завершение и возвращение на карту', () => {
    render(<App />);
    click('Начать');
    expect(
      screen.getByRole('heading', { name: 'Карта занятий' }),
    ).toHaveFocus();
    click('Продолжить');
    expect(screen.getByRole('img', { name: 'Образец: круг' })).toBeVisible();
    click('Круг');
    expect(screen.getByRole('heading', { name: 'Верно!' })).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: 'Квадрат' }),
    ).not.toBeInTheDocument();
    click('Дальше');
    expect(
      screen.getByRole('heading', { name: 'Занятие завершено!' }),
    ).toBeVisible();
    click('На карту');
    expect(
      screen.getByRole('heading', { name: 'Карта занятий' }),
    ).toBeVisible();
    click('Продолжить');
    expect(
      screen.getByRole('heading', { name: 'Найди такой же' }),
    ).toBeVisible();
  });

  it('после нескольких ошибок позволяет выбрать правильный ответ', () => {
    render(<App />);
    openTask();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      click('Квадрат');
      expect(
        screen.getByRole('heading', { name: 'Попробуй ещё' }),
      ).toBeVisible();
      expect(screen.getByRole('button', { name: 'Круг' })).toBeEnabled();
    }
    click('Круг');
    expect(screen.getByRole('heading', { name: 'Верно!' })).toBeVisible();
  });

  it('повторяет визуальную инструкцию и сбрасывает её при новом запуске', () => {
    render(<App />);
    openTask();
    const instruction = screen.getByText('Посмотри на круг. Найди такой же.');
    click('Повторить инструкцию');
    expect(instruction).toHaveClass('repeated');
    expect(instruction).toHaveFocus();
    click('Круг');
    click('Дальше');
    click('Ещё раз');
    expect(
      screen.getByRole('heading', { name: 'Найди такой же' }),
    ).toHaveFocus();
    expect(
      screen.getByText('Посмотри на круг. Найди такой же.'),
    ).not.toHaveClass('repeated');
  });

  it('игнорирует быстрый повторный переход и вторую часть двойного клика', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
    const next = screen.getByRole('button', { name: 'Продолжить' });
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
    click('Продолжить');
    expect(
      screen.getByRole('heading', { name: 'Найди такой же' }),
    ).toBeVisible();
  });
});
