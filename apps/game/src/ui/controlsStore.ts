import { create } from 'zustand';

// Keys that are not allowed as primary game actions
const BLOCKED_CODES = new Set(['Escape', 'Tab', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);

function loadKey(): string {
  const saved = localStorage.getItem('gravity-run:primary-key');
  return typeof saved === 'string' && saved.length > 0 ? saved : 'Space';
}
function loadGamepadButton(): number {
  const saved = Number(localStorage.getItem('gravity-run:gamepad-button'));
  return Number.isFinite(saved) && saved >= 0 ? saved : 0;
}
function loadBool(key: string, defaultValue: boolean): boolean {
  const saved = localStorage.getItem(key);
  return saved === null ? defaultValue : saved === 'true';
}
function loadTextScale(): number {
  const saved = Number(localStorage.getItem('gravity-run:text-scale'));
  return Number.isFinite(saved) && saved >= 0.85 && saved <= 1.5 ? saved : 1;
}

interface ControlsState {
  primaryKey: string;
  gamepadButton: number;
  leftHanded: boolean;
  textScale: number;
  isListening: boolean;
  setPrimaryKey: (code: string) => void;
  setGamepadButton: (button: number) => void;
  setLeftHanded: (lh: boolean) => void;
  setTextScale: (scale: number) => void;
  startListening: () => void;
  cancelListening: () => void;
  isValidActionCode: (code: string) => boolean;
}

export const useControlsStore = create<ControlsState>((set) => ({
  primaryKey: loadKey(),
  gamepadButton: loadGamepadButton(),
  leftHanded: loadBool('gravity-run:left-handed', false),
  textScale: loadTextScale(),
  isListening: false,

  isValidActionCode(code: string): boolean {
    return !BLOCKED_CODES.has(code);
  },

  setPrimaryKey(code: string) {
    if (BLOCKED_CODES.has(code)) return;
    localStorage.setItem('gravity-run:primary-key', code);
    set({ primaryKey: code, isListening: false });
  },

  setGamepadButton(button: number) {
    localStorage.setItem('gravity-run:gamepad-button', String(button));
    set({ gamepadButton: button });
  },

  setLeftHanded(lh: boolean) {
    localStorage.setItem('gravity-run:left-handed', String(lh));
    set({ leftHanded: lh });
  },

  setTextScale(scale: number) {
    const clamped = Math.min(Math.max(scale, 0.85), 1.5);
    localStorage.setItem('gravity-run:text-scale', String(clamped));
    set({ textScale: clamped });
  },

  startListening() { set({ isListening: true }); },
  cancelListening() { set({ isListening: false }); },
}));

export { BLOCKED_CODES };
