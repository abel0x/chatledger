/**
 * Just enough of an HTML reader for the pages Telegram Desktop exports. It
 * runs where the browser's own parser is not available (in a worker), builds
 * a plain tree and never runs or loads anything the page contains.
 */

export interface El {
  tag: string;
  classes: string[];
  attrs: Map<string, string>;
  children: Node[];
}

export type Node = El | string;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const KEPT = new Set(['class', 'id', 'href', 'src', 'title']);
/** Deeper nesting than any real page has; past it, elements are flattened into their parent. */
const MAX_DEPTH = 128;

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0' };

export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
      return String.fromCodePoint(code);
    }
    return Object.hasOwn(NAMED, body.toLowerCase()) ? (NAMED[body.toLowerCase()] as string) : whole;
  });
}

function readAttrs(src: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const m of src.matchAll(re)) {
    const name = (m[1] ?? '').toLowerCase();
    if (KEPT.has(name) && !attrs.has(name)) attrs.set(name, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''));
  }
  return attrs;
}

/** End of a tag that starts at `from`, skipping '>' inside quoted values. */
function tagEnd(html: string, from: number): number {
  let quote = '';
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return i;
  }
  return -1;
}

export function parseHtml(html: string): El {
  const root: El = { tag: '#root', classes: [], attrs: new Map(), children: [] };
  const stack: El[] = [root];
  const top = () => stack[stack.length - 1] as El;
  const text = (s: string) => {
    if (!s) return;
    const children = top().children;
    const decoded = decodeEntities(s);
    const last = children.length - 1;
    if (typeof children[last] === 'string') children[last] += decoded;
    else children.push(decoded);
  };

  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      text(html.slice(i));
      break;
    }
    text(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const next = html[lt + 1] ?? '';
    if (next === '!' || next === '?') {
      const end = html.indexOf('>', lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (next === '/') {
      const end = html.indexOf('>', lt);
      const name = html.slice(lt + 2, end === -1 ? html.length : end).trim().toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) {
        if ((stack[k] as El).tag === name) {
          stack.length = k;
          break;
        }
      }
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (!/[a-z]/i.test(next)) {
      text('<');
      i = lt + 1;
      continue;
    }
    const end = tagEnd(html, lt + 1);
    if (end === -1) break;
    const inside = html.slice(lt + 1, end);
    const name = (/^[^\s/>]+/.exec(inside)?.[0] ?? '').toLowerCase();
    const attrs = readAttrs(inside.slice(name.length));
    const el: El = { tag: name, classes: (attrs.get('class') ?? '').split(/\s+/).filter(Boolean), attrs, children: [] };
    top().children.push(el);
    i = end + 1;
    if (RAW.has(name)) {
      let close = html.indexOf('</', i);
      while (close !== -1 && html.slice(close + 2, close + 2 + name.length).toLowerCase() !== name) close = html.indexOf('</', close + 2);
      i = close === -1 ? html.length : close;
      continue;
    }
    if (VOID.has(name) || inside.endsWith('/') || stack.length > MAX_DEPTH) continue;
    stack.push(el);
  }
  return root;
}

export function isEl(n: Node | undefined): n is El {
  return typeof n === 'object';
}

export function hasClass(el: El, name: string): boolean {
  return el.classes.includes(name);
}

/** Elements below `el` that match, in document order, without looking inside matches. */
export function findAll(el: El, test: (e: El) => boolean, out: El[] = []): El[] {
  for (const c of el.children) {
    if (!isEl(c)) continue;
    if (test(c)) out.push(c);
    else findAll(c, test, out);
  }
  return out;
}

export function find(el: El, test: (e: El) => boolean): El | undefined {
  for (const c of el.children) {
    if (!isEl(c)) continue;
    if (test(c)) return c;
    const deeper = find(c, test);
    if (deeper) return deeper;
  }
  return undefined;
}

export function byClass(el: El, name: string): El | undefined {
  return find(el, e => hasClass(e, name));
}

/** Children that are elements with the class, one level down only. */
export function childByClass(el: El, name: string): El | undefined {
  return el.children.find((c): c is El => isEl(c) && hasClass(c, name));
}

/** Visible text: line breaks from <br>, the page's own line breaks and indentation dropped. */
export function textOf(n: Node): string {
  if (!isEl(n)) return n.replace(/\s*\n\s*/g, '');
  if (n.tag === 'br') return '\n';
  return n.children.map(textOf).join('');
}

/** Text with the page's whitespace squeezed, for names and labels. */
export function labelOf(n: Node): string {
  return textOf(n).replace(/\s+/g, ' ').trim();
}
