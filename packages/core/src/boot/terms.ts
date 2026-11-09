import { NamedTerm } from '@fougere/schema';
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { directoryOf, resolveConventions, type Conventions } from '../Conventions.js';

/** The terms an entity names that nothing in this process answers. */
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
