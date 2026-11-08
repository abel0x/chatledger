import { readSetting, writeSetting } from './settings';

export type Theme = 'system' | 'light' | 'dark';
export type TextSize = 'small' | 'normal' | 'large';

const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
const SIZES: readonly TextSize[] = ['small', 'normal', 'large'];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback;
}

const state = $state({
  theme: pick(readSetting('theme'), THEMES, 'system'),
  size: pick(readSetting('size'), SIZES, 'normal'),
});

export const appearance = {
  get theme(): Theme {
    return state.theme;
  },
  set theme(value: Theme) {
    state.theme = value;
    writeSetting('theme', value === 'system' ? null : value);
    apply();
  },
  get size(): TextSize {
    return state.size;
  },
  set size(value: TextSize) {
    state.size = value;
    writeSetting('size', value === 'normal' ? null : value);
    apply();
  },
};

/** Writes the choices onto <html>, where the style sheet picks them up. */
export function apply(): void {
  const root = document.documentElement;
  if (state.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = state.theme;
  if (state.size === 'normal') delete root.dataset.size;
  else root.dataset.size = state.size;
}
