import { useEffect, useRef, useState } from 'react';

type Screen = 'welcome' | 'map' | 'task' | 'incorrect' | 'correct' | 'complete';
type WrongChoice = 'plain' | 'square';

const titles: Record<Screen, string> = {
  welcome: 'Логические последовательности 4–5',
  map: 'Карта занятий',
  task: 'Найди такой же',
  incorrect: 'Попробуй ещё',
  correct: 'Верно!',
  complete: 'Занятие завершено!',
};

export function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [transitioning, setTransitioning] = useState(false);
  const [instructionRepeated, setInstructionRepeated] = useState(false);
  const [mistake, setMistake] = useState<{
    choice: WrongChoice;
    attempt: number;
  } | null>(null);
  const transitionLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const instruction = useRef<HTMLParagraphElement>(null);
  const choosing = screen === 'task' || screen === 'incorrect';

  useEffect(() => {
    heading.current?.focus();
    // A short input lock also catches two separate touch taps across screens.
    const timer = window.setTimeout(() => {
      transitionLock.current = false;
      setTransitioning(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [screen]);

  function go(next: Screen) {
    if (transitionLock.current || next === screen) return;
    transitionLock.current = true;
    setTransitioning(true);
    setInstructionRepeated(false);
    setMistake(null);
    setScreen(next);
  }

  function tryAgain(choice: WrongChoice) {
    if (transitionLock.current) return;
    // An error keeps the same choices available, including on repeated errors.
    setMistake((previous) => ({
      choice,
      attempt: (previous?.attempt ?? 0) + 1,
    }));
    setScreen('incorrect');
  }

  return (
    <main
      className="shell"
      onClickCapture={(event) => {
        if (event.detail > 1) event.stopPropagation();
      }}
      onKeyDownCapture={(event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
        }
      }}
    >
      <section
        className="panel"
        aria-labelledby="screen-title"
        key={choosing ? 'task' : screen}
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

        {choosing && (
          <>
            <p ref={instruction} tabIndex={-1} className="instruction">
              Посмотри на образец. Найди такой же.
            </p>
            <div
              className={`matching${mistake || instructionRepeated ? ' highlighted' : ''}`}
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
              <span
                className="action-guide"
                data-guide-target="answers"
                aria-hidden="true"
              />
              <div
                id="answers"
                className="answers"
                role="group"
                aria-label="Выбери такую же фигуру"
              >
                <button
                  className="answer"
                  aria-label="Синий круг с жёлтой точкой"
                  disabled={transitioning}
                  onClick={() => go('correct')}
                >
                  <span className="composite circle" aria-hidden="true">
                    <span className="inner dot" />
                  </span>
                </button>
                <button
                  className={`answer${mistake?.choice === 'plain' ? ' mistaken' : ''}`}
                  aria-label="Синий круг без точки"
                  disabled={transitioning}
                  onClick={() => tryAgain('plain')}
                >
                  <span
                    key={
                      mistake?.choice === 'plain' ? mistake.attempt : 'plain'
                    }
                    className="composite circle"
                    aria-hidden="true"
                  />
                </button>
                <button
                  className={`answer${mistake?.choice === 'square' ? ' mistaken' : ''}`}
                  aria-label="Синий круг с жёлтым квадратом"
                  disabled={transitioning}
                  onClick={() => tryAgain('square')}
                >
                  <span
                    key={
                      mistake?.choice === 'square' ? mistake.attempt : 'square'
                    }
                    className="composite circle"
                    aria-hidden="true"
                  >
                    <span className="inner square" />
                  </span>
                </button>
              </div>
            </div>
            <div className="feedback" role="status">
              {mistake ? `Попробуй ещё. Попытка ${mistake.attempt}.` : ''}
            </div>
            <button
              className="secondary"
              disabled={transitioning}
              onClick={() => {
                setInstructionRepeated(true);
                instruction.current?.focus();
              }}
            >
              <span aria-hidden="true">↻</span> Повторить инструкцию
            </button>
          </>
        )}

        {screen === 'correct' && (
          <>
            <div className="success" role="status">
              <span className="success-mark" aria-hidden="true">
                ✓
              </span>
              Получилось!
            </div>
            <div className="next-action">
              <span
                className="action-guide"
                data-guide-target="next"
                aria-hidden="true"
              />
              <button
                id="next"
                className="primary guided-action"
                disabled={transitioning}
                onClick={() => go('complete')}
              >
                Дальше <span className="play-icon" aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {screen === 'complete' && (
          <>
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
