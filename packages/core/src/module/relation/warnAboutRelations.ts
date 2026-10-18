import type { Logger } from '../../builtin/Logger.js';
import type { Hosting } from './Hosting.js';
import type { RelationCheck } from './RelationCheck.js';
import { unfinishable, unheldAmong } from './relations.js';

/**
 * What no single frond can see about a `ref()`, so it is said once every frond is installed.
 *
 * A target belongs to another frond, and a journal arrives with an extension, which rises last.
 */
export function warnAboutRelations(relations: RelationCheck[], hosting: Hosting, log: Logger): void {
  const unfinished = unfinishable(hosting);
  if (unfinished.length > 0) {
    log.warn(
      `[relations] ${unfinished.join(', ')}: a delete interrupted by a restart will not be finished. `
      + 'Install @fougere/workflow to resume it.',
    );
  }

  const unheld = unheldAmong(relations, hosting);
  if (unheld.length > 0) {
    log.warn(
      `[relations] ${unheld.join(', ')}: the target lives in another process, so a row may point to one that was deleted.`,
    );
  }
}
