import { useEffect } from 'react';

export type PersikState =
  'idle' | 'guide' | 'thinking' | 'encourage' | 'celebrate';

type PersikProps = {
  state: PersikState;
  direction?: 'left' | 'right';
};

export function Persik({ state, direction = 'right' }: PersikProps) {
  useEffect(() => {
    // Warm the five approved poses so feedback can change immediately.
    for (const pose of [
      'idle',
      'guide',
      'thinking',
      'encourage',
      'celebrate',
    ]) {
      const image = new Image();
      image.src = `/assets/persik/persik-${pose}.png`;
    }
  }, []);

  return (
    <span
      className={`persik persik-${state}`}
      data-persik-state={state}
      data-direction={state === 'guide' ? direction : undefined}
      aria-hidden="true"
    >
      <img
        key={state}
        src={`/assets/persik/persik-${state}.png`}
        width={512}
        height={724}
        alt=""
        draggable={false}
      />
    </span>
  );
}
