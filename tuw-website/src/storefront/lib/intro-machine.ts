export const INTRO_PHASES = ['staged', 'emblem', 'letters', 'tagline', 'shutter', 'done'] as const;
export type IntroPhase = (typeof INTRO_PHASES)[number];

export const INTRO_DELAYS: Record<Exclude<IntroPhase, 'done' | 'staged'>, number> = {
  emblem: 100,
  letters: 320,
  tagline: 1250,
  shutter: 2050,
};

export function nextIntroPhase(phase: IntroPhase): IntroPhase {
  const index = INTRO_PHASES.indexOf(phase);
  return INTRO_PHASES[Math.min(index + 1, INTRO_PHASES.length - 1)]!;
}

export function introFlags(phase: IntroPhase) {
  const index = INTRO_PHASES.indexOf(phase);
  return {
    emblemVisible: index >= 1,
    lettersVisible: index >= 2,
    taglineVisible: index >= 3,
    shutterUp: index >= 4,
    done: phase === 'done',
  };
}
