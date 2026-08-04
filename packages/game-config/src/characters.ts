export interface CharacterDefinition {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly lore: string;
  readonly unlockCondition: string | null; // null = always unlocked
}

export interface CosmeticTether {
  readonly id: string;
  readonly label: string;
  readonly color: string; // CSS hex
}

export const CHARACTER_ROSTER: readonly CharacterDefinition[] = [
  {
    id: 'courier',
    name: 'Courier',
    symbol: 'courier',
    lore: 'The original gravity runner. Fast, reliable, no frills.',
    unlockCondition: null,
  },
  {
    id: 'nomad',
    name: 'Nomad',
    symbol: 'nomad',
    lore: 'A drifter who mastered the orbital sling centuries ago.',
    unlockCondition: 'Reach 1,000m in a single run.',
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    symbol: 'sentinel',
    lore: 'Built to outlast the collapse. Every orbit is calculated.',
    unlockCondition: 'Achieve a 5× combo.',
  },
  {
    id: 'glitch',
    name: 'Glitch',
    symbol: 'glitch',
    lore: 'A corrupted signal given form. Breaks physics by accident.',
    unlockCondition: 'Collect 50 fragments in a single run.',
  },
  {
    id: 'wisp',
    name: 'Wisp',
    symbol: 'wisp',
    lore: 'Barely there. Moves through the collapse like smoke.',
    unlockCondition: 'Score 25,000 points.',
  },
] as const;

export const TETHER_COSMETICS: readonly CosmeticTether[] = [
  { id: 'default', label: 'Gold', color: '#f5b61b' },
  { id: 'cyan', label: 'Cyan', color: '#69d8ff' },
  { id: 'magenta', label: 'Magenta', color: '#d35cff' },
  { id: 'ember', label: 'Ember', color: '#ff6a3d' },
  { id: 'jade', label: 'Jade', color: '#3dffa0' },
  { id: 'void', label: 'Void', color: '#9b9bff' },
] as const;

export type CharacterId = (typeof CHARACTER_ROSTER)[number]['id'];
export type TetherCosmeticId = (typeof TETHER_COSMETICS)[number]['id'];
