export interface Contact {
  name: string;
  phones: string[];
  emails: string[];
  org?: string;
}

/** vCard 2.1, which Android still writes, often encodes names as quoted-printable UTF-8. */
function quotedPrintable(value: string): string {
  const bytes: number[] = [];
  const text = value.replace(/=\r?\n/g, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (c === '=' && /^[0-9A-F]{2}$/i.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...new TextEncoder().encode(c));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function unescape(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Reads the cards in a .vcf file: names, phone numbers, e-mail addresses and organisation. */
export function parseVCards(text: string): Contact[] {
  // Folded lines continue with a space or tab; quoted-printable lines end with "=".
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const last = lines.length - 1;
    if (/^[ \t]/.test(raw) && last >= 0) lines[last] += raw.slice(1);
    else if (last >= 0 && /ENCODING=QUOTED-PRINTABLE/i.test(lines[last] ?? '') && (lines[last] ?? '').endsWith('=')) lines[last] += `\n${raw}`;
    else lines.push(raw);
  }

  const cards: Contact[] = [];
  let card: (Contact & { structured?: string }) | null = null;
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const [rawKey = '', ...params] = head.split(';');
    const key = rawKey.replace(/^item\d+\./i, '').toUpperCase();
    let value = line.slice(colon + 1);
    if (params.some(p => /^ENCODING=QUOTED-PRINTABLE$/i.test(p))) value = quotedPrintable(value);
    value = unescape(value).trim();

    if (key === 'BEGIN' && /^VCARD$/i.test(value)) card = { name: '', phones: [], emails: [] };
    else if (!card) continue;
    else if (key === 'END') {
      const name = card.name || card.structured || card.org || card.phones[0] || '';
      cards.push({ name, phones: card.phones, emails: card.emails, ...(card.org ? { org: card.org } : {}) });
      card = null;
    } else if (key === 'FN') card.name = value;
    else if (key === 'N' && !card.structured) {
      const [family = '', given = '', middle = ''] = value.split(';');
      card.structured = [given, middle, family].filter(Boolean).join(' ');
    } else if (key === 'TEL' && value) card.phones.push(value);
    else if (key === 'EMAIL' && value) card.emails.push(value);
    else if (key === 'ORG' && value) card.org = value.replace(/;+$/, '').replace(/;/g, ', ');
  }
  return cards;
}
