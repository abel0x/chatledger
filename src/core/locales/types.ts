import type { EventType, MediaHint } from '../model';

export interface EventRule {
  type: EventType;
  /** Named groups: actor, targets, value, previous. */
  re: RegExp;
  /** Used when the line names no actor, e.g. "You're now an admin". */
  selfActor?: boolean;
}

export interface LocalePack {
  id: string;
  /** Words standing for the exporter in event lines ("You", "you"). */
  self: string[];
  /** Splits "A, B and C" into names. */
  listSeparator: RegExp;
  /** Strips grammatical suffixes from names in event lines, if the language has them. */
  cleanName?: (name: string) => string;
  mediaOmitted: string[];
  omittedByKind: Array<[RegExp, MediaHint]>;
  deleted: string[];
  deletedBySelf: string[];
  edited: string[];
  attachedAndroid: RegExp;
  attachedIos: RegExp;
  viewOnce: RegExp;
  pending: RegExp;
  location: RegExp;
  pollHeader: string;
  pollOption: RegExp;
  titleFromFileName: RegExp[];
  events: EventRule[];
}

/** A display name: anything up to the end, never containing ": " or a quote. */
const NAME = '(?:(?!: )[^"“”\\n])+?';
const NAME_NO_COMMA = '[^"“”,:\\n]+';
const QUOTE_OPEN = '["“]';
const QUOTE_CLOSE = '["”]';

/**
 * Compiles a rule pattern, expanding {actor}, {targets}, {value}, {previous}, {Q}, {q}.
 * {who} is an actor that stops at the first comma, for languages that write "Ali, Veli'yi ekledi".
 */
export function rule(src: string, flags = ''): RegExp {
  const out = src
    .replace(/\{who\}/g, `(?<actor>${NAME_NO_COMMA})`)
    .replace(/\{(actor|targets)\}/g, (_, g: string) => `(?<${g}>${NAME})`)
    .replace(/\{(value|previous)\}/g, (_, g: string) => `(?<${g}>[^"“”\\n]*)`)
    .replace(/\{Q\}/g, QUOTE_OPEN)
    .replace(/\{q\}/g, QUOTE_CLOSE);
  return new RegExp(`^${out}\\.?$`, flags);
}
