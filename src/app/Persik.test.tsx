import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Persik, type PersikState } from './Persik';

describe('Персик', () => {
  it.each<PersikState>(['idle', 'guide', 'thinking', 'encourage', 'celebrate'])(
    'состояние %s использует утверждённый PNG и декоративную семантику',
    (state) => {
      const { container } = render(<Persik state={state} />);
      const image = container.querySelector('img');
      expect(image).toHaveAttribute(
        'src',
        `/assets/persik/persik-${state}.png`,
      );
      expect(image).toHaveAttribute('alt', '');
      expect(image).not.toHaveAttribute('tabindex');
      expect(image).toHaveAttribute('width', '512');
      expect(image).toHaveAttribute('height', '724');
      expect(image?.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(image?.parentElement).not.toHaveAttribute('tabindex');
    },
  );

  it('применяет направление только к указывающей позе', () => {
    const { container, rerender } = render(
      <Persik state="guide" direction="left" />,
    );
    expect(container.firstChild).toHaveAttribute('data-direction', 'left');
    rerender(<Persik state="idle" direction="left" />);
    expect(container.firstChild).not.toHaveAttribute('data-direction');
  });
});
