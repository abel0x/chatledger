export type Platform = 'android' | 'ios';

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
}

export interface ParseWarning {
  line: number;
  reason: 'unparsedLine' | 'unknownEvent';
  text: string;
}

export interface Chat {
  title: string | null;
  platform: Platform;
  /** Locale of the phone that made the export, as far as it could be told. */
  locale: string;
  /** Name the exporter appears under, when the export gives it away. */
  self: string | null;
  people: string[];
  messages: Message[];
  warnings: ParseWarning[];
}
