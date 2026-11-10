import type { RpcAnswer } from '../../wire/RpcAnswer.js';
import type { Storage } from '../../storage/Storage.js';
import type { RowHosts } from './RowHosts.js';
import { dependentsOf, releasing } from './relations.js';
import { refuse, release as releaseRow } from './Release.js';
import { ErrorCode } from '../../wire/ErrorCode.js';
import { FougereError } from '../../wire/FougereError.js';

/** The questions a release travels on, served in every process: `holds`, `refuses`, `release`, `dependents`. */
export function serveRelationReadings(
  serveRpc: (operation: string, answer: RpcAnswer) => void,
  rowHosts: RowHosts,
  storageFor: (entity: string) => Storage | undefined,
): void {
  serveRpc('holds', async (invocation) => {
    const named = String(invocation.params.entity);
    const keys = (invocation.params.keys ?? []) as readonly unknown[];
    const rows = storageFor(named);
    if (!rows) {
      throw new FougereError({
        code: ErrorCode.BAD_REQUEST,
        message: `No ${named} rows are held here, so none can be said missing. Ask the process serving ${named}.`,
      });
    }
    const found = await rows.findByKeys(keys.map(String));

    return { missing: keys.filter((key) => !found.has(String(key))) };
  });

  serveRpc('dependents', (invocation) => dependentsOf(String(invocation.params.entity), rowHosts));

  serveRpc('refuses', async (invocation) => {
    const marked = await refuse(String(invocation.params.entity), invocation.params.key, releasing(rowHosts),
      (invocation.params.visited ?? []) as readonly string[]);

    return { marked };
  });

  serveRpc('forget', async (invocation) => {
    await releasing(rowHosts).forget((invocation.params.marks ?? []) as readonly string[]);

    return { forgotten: true };
  });

  serveRpc('release', async (invocation) => {
    await releaseRow(String(invocation.params.entity), invocation.params.key, releasing(rowHosts),
      (invocation.params.visited ?? []) as readonly string[]);

    return { released: true };
  });
}
