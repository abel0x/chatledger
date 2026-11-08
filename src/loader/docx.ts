/**
 * Reads the text of a Word document for preview: headings, paragraphs,
 * list items and tables with bold, italic and underline. Layout, images and
 * fonts are left out; the file itself can always be saved and opened.
 */

export interface Run {
  text: string;
  b?: true;
  i?: true;
  u?: true;
}

export type DocBlock =
  | { kind: 'p' | 'h1' | 'h2' | 'h3' | 'li'; runs: Run[] }
  | { kind: 'table'; rows: string[][] };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? '';
  });
}

/** On/off properties such as <w:b/> are on unless they say val="0" or "false". */
function on(tag: string): boolean {
  const val = /w:val="([^"]*)"/.exec(tag)?.[1];
  return val === undefined || !/^(0|false|none)$/i.test(val);
}

const TAG = /<(\/?)(w:[A-Za-z]+)([^>]*?)(\/?)>|([^<]+)/g;

export function parseDocumentXml(xml: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  let runs: Run[] | null = null;
  let kind: 'p' | 'h1' | 'h2' | 'h3' | 'li' = 'p';
  let style: Omit<Run, 'text'> = {};
  let inRunProps = false;
  let inText = false;
  let tableDepth = 0;
  let rows: string[][] = [];
  let row: string[] | null = null;
  let cell: string[] | null = null;

  const add = (text: string) => {
    if (!runs || !text) return;
    const last = runs[runs.length - 1];
    if (last && last.b === style.b && last.i === style.i && last.u === style.u) last.text += text;
    else runs.push({ text, ...style });
  };

  for (const m of xml.matchAll(TAG)) {
    const [, close, name, attrs = '', self, text] = m;
    if (text !== undefined) {
      if (inText) add(decode(text));
      continue;
    }
    const tag = m[0];
    if (!close) {
      switch (name) {
        case 'w:tbl':
          tableDepth++;
          if (tableDepth === 1) rows = [];
          break;
        case 'w:tr':
          if (tableDepth === 1) row = [];
          break;
        case 'w:tc':
          if (tableDepth === 1) cell = [];
          break;
        case 'w:p':
          if (!self) {
            runs = [];
            kind = 'p';
          }
          break;
        case 'w:pStyle': {
          const val = /w:val="([^"]*)"/.exec(attrs)?.[1] ?? '';
          const level = /^(?:heading|başlık|berschrift|titre)\s*(\d)$/i.exec(val)?.[1];
          if (/^title$/i.test(val)) kind = 'h1';
          else if (level) kind = level === '1' ? 'h1' : level === '2' ? 'h2' : 'h3';
          else if (/list/i.test(val) && kind === 'p') kind = 'li';
          break;
        }
        case 'w:numPr':
          if (kind === 'p') kind = 'li';
          break;
        case 'w:r':
          if (!self) style = {};
          break;
        case 'w:rPr':
          if (!self) inRunProps = true;
          break;
        case 'w:b':
          if (inRunProps) style = on(tag) ? { ...style, b: true } : { ...style, b: undefined };
          break;
        case 'w:i':
          if (inRunProps) style = on(tag) ? { ...style, i: true } : { ...style, i: undefined };
          break;
        case 'w:u':
          if (inRunProps) style = on(tag) ? { ...style, u: true } : { ...style, u: undefined };
          break;
        case 'w:t':
          if (!self) inText = true;
          break;
        case 'w:tab':
          add('\t');
          break;
        case 'w:br':
        case 'w:cr':
          add('\n');
          break;
      }
    } else {
      switch (name) {
        case 'w:t':
          inText = false;
          break;
        case 'w:rPr':
          inRunProps = false;
          break;
        case 'w:p': {
          const text = (runs ?? []).map(r => r.text).join('');
          if (cell) cell.push(text);
          else if (tableDepth === 0 && runs) blocks.push({ kind, runs: runs.length ? runs : [{ text: '' }] });
          runs = null;
          break;
        }
        case 'w:tc':
          if (tableDepth === 1 && row && cell) row.push(cell.join('\n').trim());
          cell = tableDepth === 1 ? null : cell;
          break;
        case 'w:tr':
          if (tableDepth === 1 && row) rows.push(row);
          row = tableDepth === 1 ? null : row;
          break;
        case 'w:tbl':
          if (tableDepth === 1) blocks.push({ kind: 'table', rows });
          tableDepth--;
          break;
      }
    }
  }

  // Runs of empty paragraphs are spacing in Word; one is enough here.
  return blocks.filter((b, i) => {
    if (b.kind === 'table') return true;
    const empty = !b.runs.some(r => r.text.trim());
    const prev = blocks[i - 1];
    return !empty || (prev !== undefined && !(prev.kind !== 'table' && !prev.runs.some(r => r.text.trim())));
  });
}
