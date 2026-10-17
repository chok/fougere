import type { RpcAnswer } from '../../wire/RpcAnswer.js';
import type { Storage } from '../../storage/Storage.js';
import type { Hosting } from './Hosting.js';
import { dependentsOf, releasing } from './relations.js';
import { release as releaseRow } from './Release.js';

/**
 * The three questions a release travels on, served in every process: `holds` is the write's
 * question asked across, `release` the delete's, `dependents` what names an entity here.
 */
export function serveRelationReadings(
  serveRpc: (operation: string, answer: RpcAnswer) => void,
  hosting: Hosting,
  storageFor: (entity: string) => Storage | undefined,
): void {
  serveRpc('holds', async (invocation) => {
    const named = String(invocation.params.entity);
    const keys = (invocation.params.keys ?? []) as readonly unknown[];
    const rows = storageFor(named);
    if (!rows) return { missing: [] };
    const found = await rows.findByKeys(keys.map(String));

    return { missing: keys.filter((key) => !found.has(String(key))) };
  });

  serveRpc('dependents', (invocation) => dependentsOf(String(invocation.params.entity), hosting));

  serveRpc('release', async (invocation) => {
    await releaseRow(String(invocation.params.entity), invocation.params.key, releasing(hosting),
      (invocation.params.visited ?? []) as readonly string[]);

    return { released: true };
  });
}
