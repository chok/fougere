/**
 * The reading, tested without a renderer — the split this package states in its own entry
 * point: `index.ts` is the contract, `./react` is the rendering, and only the first is
 * derivable.
 */
import { describe, it, expect } from 'vitest';
import { ErrorCode, FougereError } from '@fougere/core/contract';
import { fetchTopology, isOpaque, nodesOf } from '../src/topology.js';
import type { TopologyReport } from '../src/topology.js';

const report: TopologyReport = {
  since: 1,
  active: 0,
  fronds: [
    { frond: 'shipping', placement: 'remote', entities: 0, doors: 0 },
    { frond: 'shop', placement: 'local', entities: 2, doors: 2 },
    { frond: 'catalog', placement: 'local', entities: 1, doors: 1 },
  ],
  edges: [
    { from: 'shop', to: 'catalog', count: 12, errors: 0 },
    { from: 'shop', to: 'shipping', count: 3, errors: 1 },
  ],
};

describe('nodesOf', () => {
  it('puts what runs here first, then names each side of every observed call', () => {
    const nodes = nodesOf(report);

    expect(nodes.map((node) => node.frond)).toEqual(['catalog', 'shop', 'shipping']);
    expect(nodes[1]!.calls.map((edge) => edge.to)).toEqual(['catalog', 'shipping']);
    // The same edge, read from the other end — one list, two readings.
    expect(nodes[0]!.calledBy.map((edge) => edge.from)).toEqual(['shop']);
    expect(nodes[2]!.calls).toEqual([]);
  });
});

describe('isOpaque', () => {
  it('separates a remote that publishes its shape elsewhere from a frond with nothing in it', () => {
    expect(isOpaque({ frond: 'shipping', placement: 'remote', entities: 0, doors: 0 })).toBe(true);
    // A local frond with no entity is not opaque — this process DID look, and found none.
    expect(isOpaque({ frond: 'ops', placement: 'local', entities: 0, doors: 0 })).toBe(false);
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
