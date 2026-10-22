import type { Edge } from './Edge.js';
import { RankQueue } from './RankQueue.js';

/** What an order places, and what no order can: a cycle and every node waiting on one. */
export interface Ordering<N> {
  ordered: N[];
  cycle: N[];
}

/**
 * A labelled directed multigraph: two edges may join the same nodes under two labels, and an edge
 * may leave a node to come back to it. It is read both ways, and every answer follows the order the
 * nodes were added in. Whether a cycle is a fault is the caller's to say — a state machine has them,
 * a dependency may not.
 */
export class Graph<N = string, L = string> {
  private static readonly none: readonly never[] = [];

  private readonly rank = new Map<N, number>();
  private readonly leaving = new Map<N, Edge<N, L>[]>();
  private readonly arriving = new Map<N, Edge<N, L>[]>();

  add(node: N): this {
    if (this.rank.has(node)) return this;

    this.rank.set(node, this.rank.size);
    this.leaving.set(node, []);
    this.arriving.set(node, []);

    return this;
  }

  /** The same edge twice — same ends, same label — is one edge. */
  connect(from: N, to: N, label: L): this {
    this.add(from).add(to);

    const leaving = this.leaving.get(from)!;
    if (leaving.some((edge) => edge.to === to && edge.label === label)) return this;

    const edge = { from, to, label };
    leaving.push(edge);
    this.arriving.get(to)!.push(edge);

    return this;
  }

  get nodes(): N[] {
    return [...this.rank.keys()];
  }

  outgoing(node: N): readonly Edge<N, L>[] {
    return this.leaving.get(node) ?? Graph.none;
  }

  incoming(node: N): readonly Edge<N, L>[] {
    return this.arriving.get(node) ?? Graph.none;
  }

  /**
   * Each node after every node it points to, the first added first among those ready. A loop orders
   * nothing — it places a node against no other — so `cycles()` is where it is seen.
   */
  order(): Ordering<N> {
    const nodes = this.nodes;
    const waitingOn = new Map<N, number>();
    const ready = new RankQueue();

    for (const node of nodes) {
      const count = this.outgoing(node).filter((edge) => edge.to !== node).length;
      waitingOn.set(node, count);
      if (count === 0) ready.push(this.rank.get(node)!);
    }

    const ordered: N[] = [];
    while (ready.size > 0) {
      const node = nodes[ready.pop()];
      ordered.push(node);

      for (const { from } of this.incoming(node)) {
        if (from === node) continue;
        const left = waitingOn.get(from)! - 1;
        waitingOn.set(from, left);
        if (left === 0) ready.push(this.rank.get(from)!);
      }
    }

    const placed = new Set(ordered);

    return { ordered, cycle: nodes.filter((node) => !placed.has(node)) };
  }

  /** One closed path per knot of nodes that reach each other — `[a, b, a]`, or `[a, a]` for a loop. */
  cycles(): N[][] {
    return this.stronglyConnectedComponents()
      .filter((component) => component.length > 1 || this.outgoing(component[0]).some((edge) => edge.to === component[0]))
      .map((component) => this.loopThrough(component[0], new Set(component)));
  }

  /** What is joined, whichever way the edges point. */
  components(): N[][] {
    const seen = new Set<N>();
    const components: N[][] = [];

    for (const node of this.rank.keys()) {
      if (seen.has(node)) continue;
      seen.add(node);

      const component = [node];
      const join = (neighbour: N) => {
        if (seen.has(neighbour)) return;
        seen.add(neighbour);
        component.push(neighbour);
      };
      for (let next = 0; next < component.length; next++) {
        for (const { to } of this.outgoing(component[next])) join(to);
        for (const { from } of this.incoming(component[next])) join(from);
      }
      components.push(component);
    }

    return components;
  }

  /** The node, then what its edges lead to, nearest first. */
  reachableFrom(node: N): N[] {
    return this.walk(node, (current) => this.outgoing(current).map((edge) => edge.to));
  }

  /** The node, then what leads to it, nearest first. */
  reaching(node: N): N[] {
    return this.walk(node, (current) => this.incoming(current).map((edge) => edge.from));
  }

  private walk(start: N, next: (node: N) => N[]): N[] {
    if (!this.rank.has(start)) return [];

    const reached = [start];
    const seen = new Set(reached);
    for (let index = 0; index < reached.length; index++) {
      for (const node of next(reached[index])) {
        if (seen.has(node)) continue;
        seen.add(node);
        reached.push(node);
      }
    }

    return reached;
  }

  /**
   * The strongly connected components, each starting with its first-added node, in that node's order
   * — Tarjan's, walked with a stack of its own so a long chain cannot exhaust the call stack.
   */
  private stronglyConnectedComponents(): N[][] {
    const index = new Map<N, number>();
    const low = new Map<N, number>();
    const stack: N[] = [];
    const stacked = new Set<N>();
    const stronglyConnectedComponents: N[][] = [];

    const enter = (node: N) => {
      index.set(node, index.size);
      low.set(node, index.get(node)!);
      stack.push(node);
      stacked.add(node);
    };

    for (const root of this.rank.keys()) {
      if (index.has(root)) continue;
      enter(root);

      const path = [{ node: root, edge: 0 }];
      while (path.length > 0) {
        const frame = path[path.length - 1];
        const edges = this.outgoing(frame.node);

        if (frame.edge < edges.length) {
          const target = edges[frame.edge++].to;
          if (!index.has(target)) {
            enter(target);
            path.push({ node: target, edge: 0 });
          } else if (stacked.has(target)) {
            low.set(frame.node, Math.min(low.get(frame.node)!, index.get(target)!));
          }
          continue;
        }

        path.pop();
        const parent = path[path.length - 1];
        if (parent) low.set(parent.node, Math.min(low.get(parent.node)!, low.get(frame.node)!));
        if (low.get(frame.node) !== index.get(frame.node)) continue;

        const component: N[] = [];
        let member: N;
        do {
          member = stack.pop()!;
          stacked.delete(member);
          component.push(member);
        } while (member !== frame.node);
        stronglyConnectedComponents.push(component.sort((a, b) => this.rank.get(a)! - this.rank.get(b)!));
      }
    }

    return stronglyConnectedComponents.sort((a, b) => this.rank.get(a[0])! - this.rank.get(b[0])!);
  }

  /** The shortest way out of `start` and back, without leaving the knot. */
  private loopThrough(start: N, component: Set<N>): N[] {
    const cameFrom = new Map<N, N>();
    const queue = [start];

    for (let index = 0; index < queue.length; index++) {
      for (const { to } of this.outgoing(queue[index])) {
        if (to === start) {
          const back: N[] = [];
          for (let node = queue[index]; node !== start; node = cameFrom.get(node)!) back.push(node);

          return [start, ...back.reverse(), start];
        }
        if (!component.has(to) || cameFrom.has(to)) continue;
        cameFrom.set(to, queue[index]);
        queue.push(to);
      }
    }

    return [start, start];
  }
}
