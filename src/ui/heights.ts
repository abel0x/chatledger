/**
 * Row heights with prefix sums, kept in a Fenwick tree so that changing one
 * height and finding the row at a scroll offset both take O(log n), which
 * keeps chats with hundreds of thousands of messages smooth.
 */
export class HeightIndex {
  readonly length: number;
  private readonly heights: Float64Array;
  private readonly tree: Float64Array;
  private sum = 0;

  constructor(heights: ArrayLike<number>) {
    this.length = heights.length;
    this.heights = Float64Array.from(heights);
    this.tree = new Float64Array(this.length + 1);
    for (let i = 0; i < this.length; i++) {
      const h = this.heights[i] as number;
      this.sum += h;
      const node = i + 1;
      this.tree[node] = (this.tree[node] as number) + h;
      const parent = node + (node & -node);
      if (parent <= this.length) this.tree[parent] = (this.tree[parent] as number) + (this.tree[node] as number);
    }
  }

  get total(): number {
    return this.sum;
  }

  get(i: number): number {
    return this.heights[i] ?? 0;
  }

  /** Sets a row's height and returns how much it changed. */
  set(i: number, height: number): number {
    const delta = height - (this.heights[i] ?? 0);
    if (!delta || i < 0 || i >= this.length) return 0;
    this.heights[i] = height;
    this.sum += delta;
    for (let node = i + 1; node <= this.length; node += node & -node) {
      this.tree[node] = (this.tree[node] as number) + delta;
    }
    return delta;
  }

  /** Distance from the top of the list to the top of row i. */
  offsetOf(i: number): number {
    let out = 0;
    for (let node = Math.min(i, this.length); node > 0; node -= node & -node) out += this.tree[node] as number;
    return out;
  }

  /** The row that covers offset y (clamped to the list). */
  indexAt(y: number): number {
    if (this.length === 0) return 0;
    if (y <= 0) return 0;
    let node = 0;
    let rest = y;
    for (let step = 1 << Math.floor(Math.log2(this.length)); step > 0; step >>= 1) {
      const next = node + step;
      if (next <= this.length && (this.tree[next] as number) <= rest) {
        node = next;
        rest -= this.tree[next] as number;
      }
    }
    return Math.min(node, this.length - 1);
  }
}
