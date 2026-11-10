export type Platform = 'android' | 'ios' | 'telegram';
export type WhatsAppPlatform = Exclude<Platform, 'telegram'>;

/** Who an event is about: the person who exported the chat, or someone by name. */
export type Party = { self: true } | { name: string };

export type MessageKind =
  | 'text'
  | 'file'
  | 'omitted'
  | 'deleted'
  | 'event'
  | 'poll'
  | 'location'
  | 'viewOnce'
  | 'pending'
  | 'empty';

export type MediaHint =
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'sticker'
  | 'gif'
  | 'document'
  | 'contact'
  | 'unknown';

export type EventType =
  | 'encrypted'
  | 'created'
  | 'renamed'
  | 'added'
  | 'joined'
  | 'left'
  | 'removed'
  | 'iconChanged'
  | 'iconDeleted'
  | 'descriptionChanged'
  | 'onlyAdminsSend'
  | 'allMembersSend'
  | 'onlyAdminsEdit'
  | 'allMembersEdit'
  | 'nowAdmin'
  | 'securityCode'
  | 'numberChanged'
  | 'pinned'
  | 'disappearingOn'
  | 'disappearingOff'
  | 'entered'
  | 'call'
  | 'missedCall'
  | 'groupCall'
  | 'channelCreated'
  | 'migrated'
  | 'historyCleared'
  | 'signedUp'
  | 'topicCreated'
  | 'unknown';

export interface ChatEvent {
  type: EventType;
  actor?: Party;
  targets?: Party[];
  /** New name, new number, timer value: whatever the event carries. */
  value?: string;
  /** Previous name for renames. */
  previous?: string;
  /** The line as WhatsApp wrote it, kept so nothing is ever lost. */
  raw: string;
}

/** A run of text and the styles Telegram gives it; WhatsApp writes its styles into the text instead. */
export interface Span {
  text: string;
  b?: true;
  i?: true;
  u?: true;
  s?: true;
  code?: true;
  pre?: true;
  spoiler?: true;
  quote?: true;
  mention?: true;
  /** Where the text links to, as the export gives it; only web and mail links are ever followed. */
  href?: string;
}

export interface Reaction {
  /** Null for custom emoji, which exports do not include. */
  emoji: string | null;
  count: number;
}

export interface PollOption {
  label: string;
  votes: number;
}

export interface Poll {
  question: string;
  options: PollOption[];
}

export interface Message {
  /** Stable across re-imports of the same export. */
  id: string;
  /** Wall-clock time as written in the export, in seconds, read as if it were UTC. */
  time: number;
  /** Index into `Chat.people`, or null for chat events. */
  sender: number | null;
  kind: MessageKind;
  text?: string;
  /** Attachment file name exactly as the export names it. */
  file?: string;
  media?: MediaHint;
  edited?: true;
  event?: ChatEvent;
  poll?: Poll;
  /** The text with its styles, when the export marks them separately; `text` stays the plain version. */
  spans?: Span[];
  /** Id of the message this one answers. */
  replyTo?: string;
  /** Who first wrote a forwarded message. */
  forwardedFrom?: string;
  reactions?: Reaction[];
}

export interface ParseWarning {
  line: number;
  reason: 'unparsedLine' | 'unknownEvent';
  text: string;
}

export interface Chat {
  title: string | null;
  platform: Platform;
  /** Locale of the phone that made the export, as far as it could be told; empty when it does not matter. */
  locale: string;
  /** Name the exporter appears under, when the export gives it away. */
  self: string | null;
  people: string[];
  messages: Message[];
  warnings: ParseWarning[];
}
