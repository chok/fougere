/**
 * The reading, tested without a renderer — the split this package states in its own entry
 * point: `index.ts` is the contract, `./react` is the rendering, and only the first is
 * derivable.
 */
import { describe, it, expect } from 'vitest';
import { ErrorCode, FougereError } from '@fougere/core/contract';
import { fetchTopology, isOpaque, layoutOf, nodesOf } from '../src/topology.js';
import type { TopologyReport } from '../src/topology.js';

const report: TopologyReport = {
  since: 1,
  active: 0,
  fronds: [
    { frond: 'shipping', placement: 'remote', entities: 0, facades: 0 },
    { frond: 'shop', placement: 'local', entities: 2, facades: 2 },
    { frond: 'catalog', placement: 'local', entities: 1, facades: 1 },
  ],
  edges: [
    { from: 'shop', to: 'catalog', count: 12, errors: 0 },
    { from: 'shop', to: 'shipping', count: 3, errors: 1 },
  ],
  declared: {
    fronds: [
      { frond: 'shop', placement: 'local' },
      { frond: 'catalog', placement: 'local' },
      { frond: 'shipping', placement: 'remote', at: 'http://127.0.0.1:4300' },
      { frond: 'billing', placement: 'remote', at: 'http://127.0.0.1:4400' },
    ],
    edges: [
      { from: 'shop', to: 'catalog' },
      { from: 'shop', to: 'shipping' },
      { from: 'shop', to: 'billing' },
    ],
  },
};

describe('nodesOf', () => {
  it('puts what runs here first, then names each side of every observed call', () => {
    const nodes = nodesOf(report);

    expect(nodes.map((node) => node.frond)).toEqual(['catalog', 'shop', 'shipping', 'billing']);
    expect(nodes[1]!.calls.map((edge) => edge.to)).toEqual(['catalog', 'shipping']);
    // The same edge, read from the other end — one list, two readings.
    expect(nodes[0]!.calledBy.map((edge) => edge.from)).toEqual(['shop']);
    expect(nodes[2]!.calls).toEqual([]);
  });

  /**
   * The whole reason the declared half travels. `billing` answered nothing, so it is absent
   * from `fronds` and from `edges` — a monitored system reporting three healthy nodes while
   * the fourth is down is the failure this was built for.
   */
  it('names a frond that was declared and never answered', () => {
    const nodes = nodesOf(report);
    const billing = nodes.find((node) => node.frond === 'billing');

    expect(billing).toMatchObject({ placement: 'remote', silent: true, at: 'http://127.0.0.1:4400' });
    expect(nodes.filter((node) => node.silent).map((node) => node.frond)).toEqual(['billing']);
  });

  it('carries the declared address onto a frond that did answer', () => {
    const shipping = nodesOf(report).find((node) => node.frond === 'shipping');

    expect(shipping).toMatchObject({ silent: false, at: 'http://127.0.0.1:4300' });
  });
});

describe('isOpaque', () => {
  it('separates a remote that publishes its shape elsewhere from a frond with nothing in it', () => {
    expect(isOpaque({ frond: 'shipping', placement: 'remote', entities: 0, facades: 0 })).toBe(true);
    // A local frond with no entity is not opaque — this process DID look, and found none.
    expect(isOpaque({ frond: 'ops', placement: 'local', entities: 0, facades: 0 })).toBe(false);
  });
});

describe('fetchTopology', () => {
  const answering = (result: unknown) => async () => ({ jsonrpc: '2.0', id: 1, result });
  const refusing = (error: FougereError) => async () => ({
    jsonrpc: '2.0', id: 1, error: { code: -32000, message: error.message, data: error.toJSON() },
  });

  it('returns the report the app answered', async () => {
    expect(await fetchTopology('/call', answering(report) as never)).toEqual(report);
  });

  /** The package not being wired is an ANSWER — the panel explains it, it does not fail. */
  it('reads a refused op as "nothing observes here", not as a failure', async () => {
    const refusal = new FougereError({ code: ErrorCode.NOT_FOUND, message: "Unknown rpc operation 'topology'. It serves discover." });
    expect(await fetchTopology('/call', refusing(refusal) as never)).toBeUndefined();
  });

  it('lets anything else stay a failure — an app that is down must not read as unobserved', async () => {
    const down = new FougereError({ code: ErrorCode.INTERNAL_ERROR, message: 'connection refused' });
    await expect(fetchTopology('/call', refusing(down) as never)).rejects.toThrow('connection refused');
  });
});

describe('layoutOf', () => {
  /**
   * The reading the layout is FOR: what calls sits left of what it calls, whichever column a
   * hand-written placement would have put them in. Two columns could not say this — a chain of
   * three fronds put two of them in one, and the line between had to bulge around the rest.
   */
  it('puts a frond to the right of everything that calls it', () => {
    const drawing = layoutOf(nodesOf(report));
    const at = (frond: string) => drawing.nodes.find((one) => one.node.frond === frond)!.x;

    for (const edge of drawing.edges) expect(at(edge.from)).toBeLessThan(at(edge.to));
  });

  /**
   * A spline, not a line and not a curve pinned to the waypoints. Pinned, an edge takes its
   * character from how MANY points the router happened to return — two for a short hop, five for
   * one that goes around something — and no two lines in the drawing then look alike.
   */
  it('draws every link as one spline, whatever the router returned', () => {
    const drawing = layoutOf(nodesOf(report));

    for (const edge of drawing.edges) {
      expect(edge.path).toMatch(/^M [\d.-]+ [\d.-]+ C/);
      expect(edge.path).not.toContain('L');
      expect(edge.path).not.toContain('Q');
    }
  });

  /** A figure drawn over a card cannot be read, so it moves along the line until it is clear. */
  it('keeps a link’s figure out of every node', () => {
    const drawing = layoutOf(nodesOf(report));

    for (const edge of drawing.edges) {
      if (!edge.at) continue;
      for (const box of drawing.nodes) {
        const over = Math.abs(edge.at.x - box.x) < box.width / 2
          && Math.abs(edge.at.y - box.y) < box.height / 2;
        expect(over).toBe(false);
      }
    }
  });

  /**
   * A square root, read against the busiest link. Linear makes every other link a hairline; a
   * log flattens them the other way and the busiest stops looking like it. The property that
   * matters: the smallest link keeps a width — 3 calls against 12 is half, not nothing, and a
   * thin link can carry every refusal there is.
   */
  it('weighs a link against the busiest one, so a small one stays visible', () => {
    const drawing = layoutOf(nodesOf(report));
    const weight = (to: string) => drawing.edges.find((edge) => edge.to === to)!.weight;

    expect(weight('catalog')).toBe(1);
    expect(weight('shipping')).toBeCloseTo(0.5, 2);
    // Declared and never travelled — no volume to weigh, which is what the renderer breaks on.
    expect(weight('billing')).toBeUndefined();
  });

  /**
   * The one thing a counted graph cannot draw. With only what was observed, `shop → billing`
   * is not a dead line — it is no line at all, and the reader sees a healthy smaller system.
   */
  it('draws a declared link nothing has travelled, and marks it by having no count', () => {
    const drawing = layoutOf(nodesOf(report));
    const link = (to: string) => drawing.edges.find((edge) => edge.from === 'shop' && edge.to === to);

    expect(link('catalog')).toMatchObject({ count: 12, errors: 0 });
    expect(link('shipping')).toMatchObject({ count: 3, errors: 1 });
    expect(link('billing')?.count).toBeUndefined();
  });

  it('draws every link once, whichever half declared it', () => {
    const drawing = layoutOf(nodesOf(report));
    const drawn = drawing.edges.map((edge) => `${edge.from}→${edge.to}`);

    expect(drawn).toEqual([...new Set(drawn)]);
  });

  it('grows tall enough for the fuller of the two columns', () => {
    const drawing = layoutOf(nodesOf(report));
    const lowest = Math.max(...drawing.nodes.map((one) => one.y));

    expect(drawing.height).toBeGreaterThan(lowest);
  });
});
