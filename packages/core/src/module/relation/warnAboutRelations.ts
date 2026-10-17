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
      `[relations] ${unfinished.join(', ')} — declared, and this process keeps nothing on `
      + 'restart: a release interrupted here is not resumed. Install @fougere/workflow, or '
      + 'expect to finish one by hand.',
    );
  }

  const unheld = unheldAmong(relations, hosting);
  if (unheld.length > 0) {
    log.warn(
      `[relations] ${unheld.join(', ')} — declared, and nothing in this process holds them: `
      + 'no foreign key, and the target answers elsewhere. A row may name one that is gone.',
    );
  }
}
