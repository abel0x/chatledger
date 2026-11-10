/**
 * Telegram tells people apart by id, but chatledger by name. Two people who
 * share a name get a number after it, so their messages stay apart.
 */
export class People {
  readonly list: string[] = [];
  private byKey = new Map<string, string>();
  private taken = new Set<string>();
  private indexOf = new Map<string, number>();

  /** The name a person is shown under. */
  name(name: string, id?: string): string {
    const key = id ? `id:${id}` : `name:${name}`;
    let shown = this.byKey.get(key);
    if (shown === undefined) {
      shown = name;
      for (let n = 2; this.taken.has(shown); n++) shown = `${name} (${n})`;
      this.taken.add(shown);
      this.byKey.set(key, shown);
    }
    return shown;
  }

  /** Index of a person who sent messages. */
  index(name: string, id?: string): number {
    const shown = this.name(name, id);
    let i = this.indexOf.get(shown);
    if (i === undefined) {
      i = this.list.length;
      this.list.push(shown);
      this.indexOf.set(shown, i);
    }
    return i;
  }

  /** In a one-to-one chat, the person who is not the chat's name exported it. */
  self(type: string | undefined, title: string | null): string | null {
    if (type === 'saved_messages') return this.list.length === 1 ? (this.list[0] as string) : null;
    if (type !== 'personal_chat' && type !== undefined) return null;
    const others = this.list.filter(p => p !== title);
    return this.list.length === 2 && others.length === 1 ? (others[0] as string) : null;
  }
}
