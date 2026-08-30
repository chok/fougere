/**
 * Two schema-typed parameters do not make two input candidates when one is collected.
 * Provenance leaves Post as the only body candidate, so parameter order changes neither
 * the inferred judge nor the binding plan.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/contract/Invocation.js';

const root = join(import.meta.dirname, 'fixtures-collector-input');

/** A valid Post body, and the same one for both calls. */
const body = { id: 'p1', title: 'Ferns unfurl in silence' };
const state = { user: { id: 'u-1', email: 'alice@example.com', role: 'author' } };

describe('an inferred input beside a collected entity', () => {
  it('uses provenance to keep only the body entity as an input candidate', async () => {
    const scan = await scanProject(root);
    const operations = scan.fronds[0].handlers[0].operations;

    expect(scan.diagnostics.filter((d) => d.code === 'input-contract-ambiguous')).toEqual([]);
    expect(operations.get('bodyFirst')?.input?.getFields()).toHaveProperty('title');
    expect(operations.get('collectorFirst')?.input?.getFields()).toHaveProperty('title');
    await using app = await createApp({ scan, createContainer });

    const out = await createLocalRunner(app)(
      { entity: 'post', op: 'bodyFirst' },
      { ...EMPTY_INVOCATION, body, state },
    );

    expect(out).toEqual({ title: 'Ferns unfurl in silence', role: 'author' });
  });

  it('judges the same body the same way when the collected parameter is first', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    const out = await createLocalRunner(app)(
      { entity: 'post', op: 'collectorFirst' },
      { ...EMPTY_INVOCATION, body, state },
    );

    expect(out).toEqual({ title: 'Ferns unfurl in silence', role: 'author' });
  });
});
