export type Comparator<T> = (left: T, right: T) => number;

/** An immutable collection whose first element has the highest priority. */
export interface PriorityQueue<T> {
  readonly size: number;

  peek(): T | undefined;
  insert(value: T): PriorityQueue<T>;
  pop(): readonly [T, PriorityQueue<T>] | undefined;
  toArray(): readonly T[];
}

/** A priority queue optimized for small collections that are read in full. */
export class SortedPriorityQueue<T> implements PriorityQueue<T> {
  private constructor(
    private readonly compare: Comparator<T>,
    private readonly items: readonly T[],
  ) {}

  static empty<T>(compare: Comparator<T>): SortedPriorityQueue<T> {
    return new SortedPriorityQueue(compare, []);
  }

  static from<T>(
    compare: Comparator<T>,
    values: readonly T[],
  ): SortedPriorityQueue<T> {
    return new SortedPriorityQueue(compare, [...values].sort(compare));
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  insert(value: T): SortedPriorityQueue<T> {
    return SortedPriorityQueue.from(this.compare, [...this.items, value]);
  }

  pop(): readonly [T, SortedPriorityQueue<T>] | undefined {
    if (this.items.length === 0) return undefined;

    const [first, ...rest] = this.items;
    return [first, new SortedPriorityQueue(this.compare, rest)];
  }

  toArray(): readonly T[] {
    return this.items;
  }
}
