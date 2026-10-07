import type { CSSProperties } from 'react';

// W02 only. Keep CSS and state deadlines on the same adjustable timeline.
export const timings = {
  navigationLock: 500,
  guideCycle: 950,
  shell: 350,
  samplePart: 225,
  afterSample: 400,
  answers: 400,
  instruction: 225,
  choiceReaction: 450,
  retry: 800,
  confettiDelay: 275,
  confetti: 1800,
  resultHold: 500,
  completeTransition: 400,
  reducedSuccess: 1750,
} as const;

export const timeline = {
  sampleFrame: timings.shell,
  sampleCircle: timings.shell + timings.samplePart,
  sampleDot: timings.shell + timings.samplePart * 2,
  answers: timings.shell + timings.samplePart * 3 + timings.afterSample,
  instruction:
    timings.shell +
    timings.samplePart * 3 +
    timings.afterSample +
    timings.answers,
  entrance:
    timings.shell +
    timings.samplePart * 3 +
    timings.afterSample +
    timings.answers +
    timings.instruction,
  leave: timings.confettiDelay + timings.confetti + timings.resultHold,
  complete:
    timings.confettiDelay +
    timings.confetti +
    timings.resultHold +
    timings.completeTransition / 2,
  completeVisible:
    timings.confettiDelay +
    timings.confetti +
    timings.resultHold +
    timings.completeTransition,
} as const;

export const timingStyles = Object.fromEntries([
  ...Object.entries(timings).map(([name, value]) => [
    `--time-${name}`,
    `${value}ms`,
  ]),
  ...Object.entries(timeline).map(([name, value]) => [
    `--at-${name}`,
    `${value}ms`,
  ]),
  ['--time-transitionHalf', `${timings.completeTransition / 2}ms`],
]) as CSSProperties;
