import { NamedTerm } from '@fougere/schema';
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { directoryOf, resolveConventions, type Conventions } from '../Conventions.js';

/**
 * A term an entity names and nothing in this process answers — refused at boot rather than at the
 * first value judged, which answered a 500 when a `vocabulary/` file was never loaded.
 */
export function termRefusals(fronds: readonly FrondDescriptor[], conventions: Conventions = resolveConventions()): Diagnostic[] {
  return fronds.flatMap((frond) => frond.entities.flatMap(({ entityClass, filePath }) =>
    NamedTerm.in(entityClass).filter((term) => !term.answered()).map((term) => ({
      severity: 'blocking' as const,
      code: 'term-missing',
      frond: frond.name,
      subject: entityClass.name,
      filePath,
      message: `${entityClass.name}.${term.field} uses the ${term.kind} '${term.name}', which is not defined. `
        + `Export it from ${directoryOf(frond.name, 'vocabulary', conventions)}.`,
    }))));
}
