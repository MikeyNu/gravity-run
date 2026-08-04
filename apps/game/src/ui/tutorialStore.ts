import { create } from 'zustand';

export type TutorialStep =
  | 'hold-to-latch'
  | 'release-to-launch'
  | 'chain-wells'
  | 'avoid-collapse'
  | 'complete';

export interface TutorialHint {
  title: string;
  body: string;
}

const HINTS: Readonly<Record<TutorialStep, TutorialHint>> = {
  'hold-to-latch': {
    title: 'Lock On',
    body: 'Hold your finger / press and hold Space to lock onto a gravity well.',
  },
  'release-to-launch': {
    title: 'Release to Launch',
    body: 'Release at the right moment to slingshot forward. A perfect release means maximum speed.',
  },
  'chain-wells': {
    title: 'Chain Wells',
    body: 'Lock onto another well immediately after releasing. Chaining builds your combo multiplier.',
  },
  'avoid-collapse': {
    title: 'Outrun the Collapse',
    body: 'The orange wall closes behind you. Keep moving forward or you\'ll be caught.',
  },
  complete: { title: '', body: '' },
};

const STEPS: TutorialStep[] = ['hold-to-latch', 'release-to-launch', 'chain-wells', 'avoid-collapse', 'complete'];

const STORAGE_KEY = 'gravity-run:tutorial-step';

function loadPersistedStep(): TutorialStep {
  const saved = localStorage.getItem(STORAGE_KEY);
  return STEPS.includes(saved as TutorialStep) ? (saved as TutorialStep) : 'hold-to-latch';
}

interface TutorialState {
  enabled: boolean;
  currentStep: TutorialStep;
  hint: TutorialHint;
  visible: boolean;
  advance: () => void;
  skip: () => void;
  show: () => void;
  hide: () => void;
  reset: () => void;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  enabled: true,
  currentStep: loadPersistedStep(),
  hint: HINTS[loadPersistedStep()],
  visible: false,

  advance() {
    const { currentStep } = get();
    const index = STEPS.indexOf(currentStep);
    const next = STEPS[index + 1] ?? 'complete';
    localStorage.setItem(STORAGE_KEY, next);
    set({ currentStep: next, hint: HINTS[next], visible: next !== 'complete' });
  },

  skip() {
    localStorage.setItem(STORAGE_KEY, 'complete');
    set({ currentStep: 'complete', visible: false, enabled: false });
  },

  show() { set({ visible: true }); },
  hide() { set({ visible: false }); },

  reset() {
    localStorage.setItem(STORAGE_KEY, 'hold-to-latch');
    set({ currentStep: 'hold-to-latch', hint: HINTS['hold-to-latch'], visible: false, enabled: true });
  },
}));

export { HINTS };
