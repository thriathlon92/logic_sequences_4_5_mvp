import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { timeline, timings, timingStyles } from './timings';
import { Persik, type PersikState } from './Persik';

type Screen = 'welcome' | 'map' | 'task' | 'incorrect' | 'correct' | 'complete';
type Phase =
  'idle' | 'entrance' | 'ready' | 'press' | 'error' | 'success' | 'leaving';
type Choice = 'copy' | 'plain' | 'square';

const titles: Record<Screen, string> = {
  welcome: 'Логические последовательности 4–5',
  map: 'Карта занятий',
  task: 'Найди такой же',
  incorrect: 'Попробуй ещё',
  correct: 'Верно!',
  complete: 'Занятие завершено!',
};
// Fixed local burst: reproducible positions, rotations and shapes, no content engine.
const particles = [
  [-178, -105, -90],
  [-138, -148, 120],
  [-92, -164, -150],
  [-44, -140, 100],
  [12, -172, -120],
  [65, -152, 160],
  [116, -134, -80],
  [174, -94, 140],
  [186, -38, -130],
  [151, 22, 110],
  [110, 68, -170],
  [58, 95, 130],
  [5, 112, -100],
  [-53, 94, 150],
  [-108, 70, -140],
  [-156, 30, 90],
  [-185, -30, -160],
  [-123, -70, 180],
  [85, -72, -110],
  [28, 52, 140],
];

export function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [phase, setPhase] = useState<Phase>('idle');
  const [transitioning, setTransitioning] = useState(false);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [instructionRepeated, setInstructionRepeated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const transitionLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const instruction = useRef<HTMLParagraphElement>(null);
  const inTask =
    screen === 'task' || screen === 'incorrect' || screen === 'correct';
  const answersLocked = phase !== 'ready';

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    heading.current?.focus();
  }, [screen]);

  useEffect(() => {
    let timer: number | undefined;
    if (phase === 'idle' || phase === 'entrance' || phase === 'error') {
      const delay =
        phase === 'idle'
          ? timings.navigationLock
          : phase === 'error'
            ? timings.retry - (reducedMotion ? 0 : timings.choiceReaction)
            : reducedMotion
              ? 0
              : timeline.entrance;
      timer = window.setTimeout(() => {
        transitionLock.current = false;
        setTransitioning(false);
        if (phase !== 'idle') setPhase('ready');
      }, delay);
    } else if (phase === 'press') {
      timer = window.setTimeout(
        () => {
          if (selected === 'copy') {
            setPhase('success');
          } else {
            setAttempt((value) => value + 1);
            setPhase('error');
          }
        },
        reducedMotion ? 0 : timings.choiceReaction,
      );
    } else if (phase === 'success') {
      timer = window.setTimeout(
        () => {
          if (reducedMotion) {
            setScreen('complete');
            setPhase('idle');
            setTransitioning(true);
          } else setPhase('leaving');
        },
        reducedMotion
          ? timings.reducedSuccess
          : timeline.leave - timings.choiceReaction,
      );
    } else if (phase === 'leaving') {
      timer = window.setTimeout(
        () => {
          setScreen('complete');
          setPhase('idle');
          setTransitioning(true);
        },
        reducedMotion ? 0 : timings.completeTransition / 2,
      );
    }
    return () => window.clearTimeout(timer);
  }, [phase, screen, selected, reducedMotion]);

  function go(next: 'map' | 'task') {
    if (transitionLock.current || next === screen) return;
    transitionLock.current = !reducedMotion || next !== 'task';
    setTransitioning(true);
    setInstructionRepeated(false);
    setSelected(null);
    setAttempt(0);
    setPhase(next === 'task' ? (reducedMotion ? 'ready' : 'entrance') : 'idle');
    setScreen(next);
  }

  function choose(choice: Choice) {
    if (transitionLock.current || phase !== 'ready') return;
    transitionLock.current = true;
    setInstructionRepeated(false);
    setSelected(choice);
    setScreen(choice === 'copy' ? 'correct' : 'incorrect');
    setPhase('press');
  }

  const celebrating =
    selected === 'copy' && ['press', 'success', 'leaving'].includes(phase);
  const persikState: PersikState = celebrating
    ? 'celebrate'
    : phase === 'press' || phase === 'error'
      ? 'encourage'
      : 'idle';
  function answerClass(choice: Choice) {
    const mistaken =
      selected === choice &&
      choice !== 'copy' &&
      (phase === 'press' || phase === 'error');
    return `answer${mistaken ? ' mistaken' : ''}${celebrating ? (choice === 'copy' ? ' won' : ' muted') : ''}`;
  }

  return (
    <main
      className="shell"
      style={timingStyles}
      onClickCapture={(event) => {
        if (event.detail > 1) event.stopPropagation();
      }}
      onKeyDownCapture={(event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' '))
          event.preventDefault();
      }}
    >
      <section
        className={`panel${phase === 'entrance' ? ' task-arriving' : phase === 'leaving' ? ' leaving' : screen === 'complete' ? ' complete-arriving' : ''}`}
        aria-labelledby="screen-title"
        key={inTask ? 'task' : screen}
      >
        <div className={inTask ? 'task-heading' : 'screen-heading'}>
          {inTask && (
            <div className="task-companion">
              <Persik state={persikState} />
            </div>
          )}
          <h1 id="screen-title" ref={heading} tabIndex={-1}>
            {titles[screen]}
          </h1>
        </div>
        {screen === 'welcome' && (
          <>
            <div className="shapes" aria-hidden="true">
              <span className="shape circle" />
              <span className="shape square" />
            </div>
            <div className="next-action">
              <Persik state="guide" direction="right" />
              <button
                id="start"
                className="primary guided-action"
                onClick={() => go('map')}
              >
                Начать <span className="play-icon" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
        {screen === 'map' && (
          <div className="next-action lesson-route">
            <Persik state="guide" direction="right" />
            <button
              id="lesson"
              className="primary lesson guided-action"
              disabled={transitioning}
              onClick={() => go('task')}
              aria-label="Начать демонстрационное занятие"
            >
              <span className="composite circle" aria-hidden="true">
                <span className="inner dot" />
              </span>
              <span>Попробуем вместе</span>
              <span className="play-icon" aria-hidden="true" />
            </button>
          </div>
        )}
        {inTask && (
          <div
            className={`task-content${phase === 'entrance' ? ' entering' : ''}`}
            data-phase={phase}
          >
            <p ref={instruction} tabIndex={-1} className="instruction">
              Посмотри на образец. Найди такой же.
            </p>
            <div
              className={`matching${instructionRepeated ? ' highlighted' : ''}`}
            >
              <div
                className="sample"
                role="img"
                aria-label="Образец: синий круг с жёлтой точкой"
              >
                <span className="composite circle" aria-hidden="true">
                  <span className="inner dot" />
                </span>
              </div>
              <div
                id="answers"
                className="answers"
                role="group"
                aria-label="Выбери такую же фигуру"
                aria-busy={answersLocked}
              >
                <button
                  className={answerClass('copy')}
                  aria-label="Синий круг с жёлтой точкой"
                  disabled={answersLocked}
                  onClick={() => choose('copy')}
                >
                  <span className="composite circle" aria-hidden="true">
                    <span className="inner dot" />
                  </span>
                </button>
                <button
                  className={answerClass('plain')}
                  aria-label="Синий круг без точки"
                  disabled={answersLocked}
                  onClick={() => choose('plain')}
                >
                  <span className="composite circle" aria-hidden="true" />
                </button>
                <button
                  className={answerClass('square')}
                  aria-label="Синий круг с жёлтым квадратом"
                  disabled={answersLocked}
                  onClick={() => choose('square')}
                >
                  <span className="composite circle" aria-hidden="true">
                    <span className="inner square" />
                  </span>
                </button>
              </div>
              <div className="feedback" role="status">
                {celebrating ? (
                  <>
                    <span className="success-mark" aria-hidden="true">
                      ✓
                    </span>
                    Получилось!
                  </>
                ) : attempt > 0 ? (
                  `Попробуй ещё. Попытка ${attempt}.`
                ) : (
                  ''
                )}
              </div>
              {celebrating && !reducedMotion && (
                <div className="celebration" aria-hidden="true">
                  {particles.map(([x, y, rotation], index) => (
                    <span
                      key={index}
                      className="particle"
                      style={
                        {
                          '--x': `${x}px`,
                          '--y': `${y}px`,
                          '--rotation': `${rotation}deg`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              )}
            </div>
            <button
              className="secondary repeat-instruction"
              disabled={answersLocked}
              onClick={() => {
                setInstructionRepeated(true);
                instruction.current?.focus();
              }}
            >
              <span aria-hidden="true">↻</span> Повторить инструкцию
            </button>
          </div>
        )}
        {screen === 'complete' && (
          <>
            <div className="completion-mark" aria-hidden="true">
              ✓
            </div>
            <p>Ты справился!</p>
            <div className="next-action">
              <Persik state="guide" direction="right" />
              <button
                id="home"
                className="primary guided-action home-action"
                disabled={transitioning}
                onClick={() => go('map')}
              >
                <span className="home-icon" aria-hidden="true" />
                На карту
              </button>
            </div>
            <button
              className="secondary"
              disabled={transitioning}
              onClick={() => go('task')}
            >
              <span aria-hidden="true">↻</span> Ещё раз
            </button>
          </>
        )}
      </section>
    </main>
  );
}
