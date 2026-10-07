import { useEffect, useRef, useState, type CSSProperties } from 'react';

type Screen = 'welcome' | 'map' | 'task' | 'incorrect' | 'correct' | 'complete';
type Phase = 'idle' | 'entrance' | 'ready' | 'press' | 'error' | 'success';
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
          ? 500
          : phase === 'error'
            ? 450
            : reducedMotion
              ? 0
              : 800;
      timer = window.setTimeout(() => {
        transitionLock.current = false;
        setTransitioning(false);
        if (phase !== 'idle') setPhase('ready');
      }, delay);
    } else if (phase === 'press') {
      timer = window.setTimeout(
        () => {
          if (selected === 'copy') {
            setScreen('correct');
            setPhase('success');
          } else {
            setAttempt((value) => value + 1);
            setScreen('incorrect');
            setPhase('error');
          }
        },
        reducedMotion ? 0 : 120,
      );
    } else if (phase === 'success') {
      timer = window.setTimeout(
        () => {
          setScreen('complete');
          setPhase('idle');
          setTransitioning(true);
        },
        reducedMotion ? 400 : 1200,
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
    setPhase('press');
  }

  function answerClass(choice: Choice) {
    return `answer${selected === choice && phase === 'press' ? ' pressed' : ''}${selected === choice && phase === 'error' ? ' mistaken' : ''}${phase === 'success' ? (choice === 'copy' ? ' won' : ' muted') : ''}`;
  }

  return (
    <main
      className="shell"
      onClickCapture={(event) => {
        if (event.detail > 1) event.stopPropagation();
      }}
      onKeyDownCapture={(event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' '))
          event.preventDefault();
      }}
    >
      <section
        className="panel"
        aria-labelledby="screen-title"
        key={inTask ? 'task' : screen}
      >
        <h1 id="screen-title" ref={heading} tabIndex={-1}>
          {titles[screen]}
        </h1>
        {screen === 'welcome' && (
          <>
            <div className="shapes" aria-hidden="true">
              <span className="shape circle" />
              <span className="shape square" />
            </div>
            <div className="next-action">
              <span
                className="action-guide"
                data-guide-target="start"
                aria-hidden="true"
              />
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
            <span
              className="action-guide"
              data-guide-target="lesson"
              aria-hidden="true"
            />
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
                {phase === 'success' ? (
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
              {phase === 'success' && !reducedMotion && (
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
              <span
                className="action-guide"
                data-guide-target="home"
                aria-hidden="true"
              />
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
