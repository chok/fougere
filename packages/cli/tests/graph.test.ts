/**
 * `graph` at both altitudes: where the fronds run and which reaches which, then how the
 * entities reference each other. One picture, read without booting and without anything
 * running — `remotes:` and a constructor say it, so nothing has to answer for it to be true.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import GraphHandler from '../fronds/analysis/handlers/GraphHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';
import { machineText } from '../src/machine.js';

const fixture = join(import.meta.dirname, 'fixtures-graph');
const graph = () => new GraphHandler(new ProjectScan());

describe('the frond altitude', () => {
  it('takes the placement from the config and the crossing from a dependency', async () => {
    const result = await graph().execute({ root: fixture });

    expect(result.declared.fronds).toEqual([
      { frond: 'commande', placement: 'local' },
      { frond: 'stock', placement: 'remote', at: 'http://127.0.0.1:4100' },
    ]);
    expect(result.declared.edges).toEqual([{ from: 'commande', to: 'stock' }]);
  }, 30_000);

  /** A declared address may carry credentials, and `--json` is piped into whatever asked. */
  it('keeps host and port, never the rest of the address', async () => {
    const result = await graph().execute({ root: fixture });

    expect(machineText(result.declared)).not.toContain('hidden');
  }, 30_000);
});

describe('what a pipe reads', () => {
  it('carries both altitudes through JSON, the entity graph included', async () => {
    const parsed = JSON.parse(machineText(await graph().execute({ root: fixture })));

    expect(parsed.declared.edges).toEqual([{ from: 'commande', to: 'stock' }]);
    // `nodes` is a Map, which serializes to `{}` unless the door converts it.
    expect(Object.keys(parsed.nodes)).toContain('commande');
  }, 30_000);
});
