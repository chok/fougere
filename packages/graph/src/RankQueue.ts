/** The lowest rank first — a binary heap, so ordering a graph costs a log per node, never a scan. */
export class RankQueue {
  private readonly heap: number[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(rank: number): void {
    const heap = this.heap;
    heap.push(rank);

    let child = heap.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (heap[parent] <= rank) break;
      heap[child] = heap[parent];
      child = parent;
    }
    heap[child] = rank;
  }

  pop(): number {
    const heap = this.heap;
    const lowest = heap[0];
    const last = heap.pop()!;
    if (heap.length === 0) return lowest;

    let parent = 0;
    while (true) {
      const left = 2 * parent + 1;
      if (left >= heap.length) break;
      const right = left + 1;
      const smaller = right < heap.length && heap[right] < heap[left] ? right : left;
      if (heap[smaller] >= last) break;
      heap[parent] = heap[smaller];
      parent = smaller;
    }
    heap[parent] = last;

    return lowest;
  }
}
