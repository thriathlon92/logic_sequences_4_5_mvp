import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('Оболочка приложения', () => {
  it('показывает доступную стартовую страницу', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Логические последовательности 4–5',
      }),
    ).toBeVisible();
  });
});
