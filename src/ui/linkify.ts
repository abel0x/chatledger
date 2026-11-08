export type Part = { text: string; href?: undefined } | { text: string; href: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
// Punctuation, and WhatsApp's style marks when a link sits inside *bold* or _italic_.
const TRAILING = /[.,;:!?'")\]}>…*_~]+$/;

/** Splits message text into plain runs and web links; nothing else is ever turned into markup. */
export function linkify(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    const start = m.index;
    // Keep a closing bracket that belongs to the link, e.g. a wiki page about (something).
    const trail = TRAILING.exec(url)?.[0] ?? '';
    if (trail) url = url.slice(0, -trail.length);
    if (!url.includes('.', url.indexOf('//') + 2) && !url.startsWith('www.')) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url.toLowerCase().startsWith('www.') ? `https://${url}` : url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
