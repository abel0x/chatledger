import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { pt } from './pt';
import { tr } from './tr';
import type { LocalePack } from './types';

export type { LocalePack, EventRule } from './types';

export const LOCALES: readonly LocalePack[] = [en, tr, es, pt, de, fr, it];
