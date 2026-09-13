/**
 * What an app declares about its neighbours, read without calling any of them.
 *
 * The dual of the identity card: one says what this app serves, the other where the rest of
 * the system is supposed to be. Both are needed because the observed half cannot report a
 * frond that never answered — it is absent from it, which reads as a healthy smaller system.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { declaredTopologyOf, resolveEffectiveOperations } from '../src/index.js';
import type { FrondDescriptor } from '../src/descriptor/frond.js';

const root = join(import.meta.dirname, 'fixtures-cross-frond');

const scanned = async (): Promise<FrondDescriptor[]> => (await scanProject(root)).fronds;

describe('the fronds', () => {
  it('calls a frond local when no address names it', async () => {
    const declared = declaredTopologyOf({ fronds: await scanned(), remotes: {} });

    expect(declared.fronds).toEqual([
      { frond: 'commande', placement: 'local' },
      { frond: 'stock', placement: 'local' },
    ]);
  });

  it('takes the address from the config, and keeps host and port only', async () => {
    const declared = declaredTopologyOf({
      fronds: await scanned(),
      remotes: { stock: 'https://user:secret@stock.example.com:8443/rpc?token=abc' },
    });

    expect(declared.fronds).toEqual([
      { frond: 'commande', placement: 'local' },
      { frond: 'stock', placement: 'remote', at: 'https://stock.example.com:8443' },
    ]);
  });

  /**
   * `remotes:` excludes any local copy, so a scanned frond named there is reported once and
   * as remote. Reporting it twice would let a reader believe two of them exist.
   */
  it('names a scanned frond once when the config moved it out', async () => {
    const declared = declaredTopologyOf({
      fronds: await scanned(),
      remotes: { stock: 'http://127.0.0.1:4100' },
    });

    expect(declared.fronds.filter((one) => one.frond === 'stock')).toHaveLength(1);
  });

  /** A frond an extension brought instruments this app; it is not part of what it depends on. */
  it('leaves out a frond an extension brought', async () => {
    const fronds = await scanned();
    const declared = declaredTopologyOf({
      fronds: [...fronds, { ...fronds[0]!, name: 'ring', brought: true }],
      remotes: {},
    });

    expect(declared.fronds.map((one) => one.frond)).not.toContain('ring');
  });
});

describe('the edges', () => {
  it('reads a crossing off the dependency that declares it', async () => {
    const declared = declaredTopologyOf({ fronds: await scanned(), remotes: {} });

    expect(declared.edges).toEqual([{ from: 'commande', to: 'stock' }]);
  });

  /**
   * A dependency on this frond's own door is not a crossing, and neither is a type key: the
   * two namespaces are separated by CASE — camelCase for a façade, PascalCase for a type —
   * which is the rule `verify()` already states.
   */
  it('ignores a dependency that names something of this frond', async () => {
    const fronds = await scanned();
    const commande = fronds.find((frond) => frond.name === 'commande')!;
    const handler = commande.handlers[0]!;

    const declared = declaredTopologyOf({
      fronds: fronds.map((frond) => (frond.name !== 'commande' ? frond : {
        ...frond,
        handlers: [{ ...handler, deps: ['CommandeRepository', 'Logger', 'commandeHandler'] }],
      })),
      remotes: {},
    });

    expect(declared.edges).toEqual([]);
  });

  /**
   * An address served by a frond this app never scanned resolves to nothing, so the crossing
   * is left out rather than guessed. Naming the frond behind it would mean reading its card,
   * and a card is a DISCOVERY — the other half of the report.
   */
  it('says nothing about a crossing whose far side was never scanned', async () => {
    const fronds = await scanned();
    const declared = declaredTopologyOf({
      fronds: fronds.filter((frond) => frond.name === 'commande'),
      remotes: { stock: 'http://127.0.0.1:4100' },
    });

    expect(declared.edges).toEqual([]);
    expect(declared.fronds.map((one) => one.frond)).toEqual(['commande', 'stock']);
  });
});

describe('what an op reaches', () => {
  /**
   * The number every hard-coded constant is a function of. A sampling rate, a histogram's
   * bounds and a load threshold all assume how far an operation's work goes, and each is a
   * single value written down today for operations that are not the same subject at all.
   */
  it('counts a hop when the frond it reaches answers from another process', async () => {
    const fronds = await scanned();
    const { operations } = resolveEffectiveOperations(fronds, { remotes: { stock: 'http://127.0.0.1:4100' } });
    const servable = operations.find((op) => op.name === 'servable')!;

    expect(servable.reach).toEqual({ fronds: [{ frond: 'stock', runtime: 'remote' }], hops: 1 });
  });

  it('counts none when everything it reaches runs here', async () => {
    const { operations } = resolveEffectiveOperations(await scanned(), {});
    const servable = operations.find((op) => op.name === 'servable')!;

    expect(servable.reach).toEqual({ fronds: [{ frond: 'stock', runtime: 'local' }], hops: 0 });
  });

  /** Answering from elsewhere is not reaching elsewhere — `placement` already says the first. */
  it('says nothing of the op that is itself remote but reaches nobody', async () => {
    const { operations } = resolveEffectiveOperations(await scanned(), { remotes: { stock: 'http://127.0.0.1:4100' } });
    const onHand = operations.find((op) => op.name === 'onHand')!;

    expect(onHand.placement.runtime).toBe('remote');
    expect(onHand.reach).toEqual({ fronds: [], hops: 0 });
  });
});
