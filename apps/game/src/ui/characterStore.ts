import { create } from 'zustand';
import {
  CHARACTER_ROSTER,
  TETHER_COSMETICS,
  type CharacterId,
  type TetherCosmeticId,
} from '@gravity-run/game-config';

const CHAR_KEY = 'gravity-run:character';
const TETHER_KEY = 'gravity-run:tether';
const UNLOCKED_KEY = 'gravity-run:unlocked-chars';

function loadSelectedChar(): CharacterId {
  const saved = localStorage.getItem(CHAR_KEY);
  return CHARACTER_ROSTER.some((c) => c.id === saved) ? (saved as CharacterId) : 'courier';
}

function loadSelectedTether(): TetherCosmeticId {
  const saved = localStorage.getItem(TETHER_KEY);
  return TETHER_COSMETICS.some((t) => t.id === saved) ? (saved as TetherCosmeticId) : 'default';
}

function loadUnlocked(): Set<CharacterId> {
  const raw = localStorage.getItem(UNLOCKED_KEY);
  const ids: CharacterId[] = raw ? (JSON.parse(raw) as CharacterId[]) : [];
  // Courier is always unlocked
  ids.push('courier');
  return new Set(ids);
}

function persistUnlocked(ids: Set<CharacterId>): void {
  localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...ids]));
}

interface CharacterState {
  selectedCharacterId: CharacterId;
  selectedTetherCosmeticId: TetherCosmeticId;
  unlockedCharacterIds: ReadonlySet<CharacterId>;
  selectCharacter: (id: CharacterId) => void;
  selectTether: (id: TetherCosmeticId) => void;
  unlockCharacter: (id: CharacterId) => void;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  selectedCharacterId: loadSelectedChar(),
  selectedTetherCosmeticId: loadSelectedTether(),
  unlockedCharacterIds: loadUnlocked(),

  selectCharacter(id) {
    if (!get().unlockedCharacterIds.has(id)) return;
    localStorage.setItem(CHAR_KEY, id);
    set({ selectedCharacterId: id });
  },

  selectTether(id) {
    localStorage.setItem(TETHER_KEY, id);
    set({ selectedTetherCosmeticId: id });
  },

  unlockCharacter(id) {
    const next = new Set(get().unlockedCharacterIds);
    next.add(id);
    persistUnlocked(next);
    set({ unlockedCharacterIds: next });
  },
}));
