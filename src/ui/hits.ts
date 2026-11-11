import type { Message } from '../core';
import { searchableText, snippet } from '../core/search';
import { eventText, t } from '../i18n/index.svelte';

/** The line a search result shows for a message, cut to the part around the match. */
export function hitText(m: Message, self: string | null, terms: string[]): string {
  if (m.event) return eventText(m.event, self);
  const text = searchableText(m);
  if (text) return snippet(text, terms);
  if (m.kind === 'omitted') return t('msg.notIncluded', { what: t(`media.${m.media ?? 'unknown'}`) });
  if (m.kind === 'deleted') return t('msg.deleted');
  return '';
}
