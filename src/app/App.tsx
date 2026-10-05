import { useEffect, useRef, useState } from 'react';

type Screen = 'welcome' | 'map' | 'task' | 'incorrect' | 'correct' | 'complete';

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
    setScreen(next);
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
      <section className="panel" aria-labelledby="screen-title" key={screen}>
        <h1 id="screen-title" ref={heading} tabIndex={-1}>
          {titles[screen]}
        </h1>

        {screen === 'welcome' && (
          <>
            <div className="shapes" aria-hidden="true">
              <span className="shape circle" />
              <span className="shape square" />
            </div>
            <button className="primary" onClick={() => go('map')}>
              Начать <span aria-hidden="true">→</span>
            </button>
          </>
        )}

        {screen === 'map' && (
          <>
            <div
              className="lesson"
              aria-label="Демонстрационное занятие доступно"
            >
              <span className="shape circle" aria-hidden="true" />
              <p>Попробуем вместе</p>
            </div>
            <button
              className="primary"
              disabled={transitioning}
              onClick={() => go('task')}
            >
              Продолжить <span aria-hidden="true">→</span>
            </button>
          </>
        )}

        {choosing && (
          <>
            <p
              ref={instruction}
              tabIndex={-1}
              className={
                instructionRepeated ? 'instruction repeated' : 'instruction'
              }
            >
              Посмотри на круг. Найди такой же.
            </p>
            <div className="sample" role="img" aria-label="Образец: круг">
              <span className="shape circle" />
            </div>
            <div className="feedback" role="status">
              {screen === 'incorrect' ? 'Выбери другую фигуру.' : ''}
            </div>
            <div
              className="answers"
              role="group"
              aria-label="Выбери такую же фигуру"
            >
              <button
                className="answer"
                aria-label="Круг"
                disabled={transitioning}
                onClick={() => go('correct')}
              >
                <span className="shape circle" aria-hidden="true" />
              </button>
              <button
                className="answer"
                aria-label="Квадрат"
                disabled={transitioning}
                onClick={() => go('incorrect')}
              >
                <span className="shape square" aria-hidden="true" />
              </button>
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
              <span aria-hidden="true">✓</span> Получилось!
            </div>
            <button
              className="primary"
              disabled={transitioning}
              onClick={() => go('complete')}
            >
              Дальше <span aria-hidden="true">→</span>
            </button>
          </>
        )}

        {screen === 'complete' && (
          <>
            <div className="shapes" aria-hidden="true">
              <span className="shape circle" />
              <span className="shape square" />
              <span className="shape circle" />
            </div>
            <p>Ты справился!</p>
            <button
              className="primary"
              disabled={transitioning}
              onClick={() => go('map')}
            >
              На карту <span aria-hidden="true">→</span>
            </button>
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
