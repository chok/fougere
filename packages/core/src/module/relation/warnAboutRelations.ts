import type { Logger } from '../../builtin/Logger.js';
import type { RowHosts } from './RowHosts.js';
import type { RelationCheck } from './RelationCheck.js';
import { arbitratedHereOnly, unarbitratedRelations, unfinishable } from './relations.js';

/**
 * What no single frond can see about a `ref()`, so it is said once every frond is installed.
 *
 * A target belongs to another frond, and a journal arrives with an extension, which rises last.
 */
export function warnAboutRelations(relations: RelationCheck[], rowHosts: RowHosts, log: Logger): void {
  const unfinished = unfinishable(rowHosts);
  if (unfinished.length > 0) {
    log.warn(
      `[relations] ${unfinished.join(', ')}: a delete interrupted by a restart will not be finished. `
      + 'Install @fougere/workflow to resume it.',
    );
  }

  const hereOnly = arbitratedHereOnly(relations);
  if (hereOnly.length > 0) {
    log.warn(
      `[relations] ${hereOnly.join(', ')}: this source has no transactions, so a write and a delete of its target `
      + 'are arbitrated in this process only. A second process writing the same rows is not seen.',
    );
  }

  const unarbitrated = unarbitratedRelations(relations);
  if (unarbitrated.length > 0) {
    log.warn(
      `[relations] ${unarbitrated.join(', ')}: the target's rows are in another source and this one holds no marks, `
      + 'so a row may point to one that was deleted.',
    );
  }
}
