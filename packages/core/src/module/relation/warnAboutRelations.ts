import type { Logger } from '../../builtin/Logger.js';
import type { RowHosts } from './RowHosts.js';
import type { RelationCheck } from './RelationCheck.js';
import { unfinishable, uncheckableRelations } from './relations.js';

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

  const uncheckable = uncheckableRelations(relations, rowHosts);
  if (uncheckable.length > 0) {
    log.warn(
      `[relations] ${uncheckable.join(', ')}: the target lives in another process, so a row may point to one that was deleted.`,
    );
  }
}
