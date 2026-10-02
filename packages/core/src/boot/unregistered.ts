import type { Container } from '@fougere/container';
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';

type Declared = { frond: string; filePath: string };

/** Every class a frond hands the container, by identity — the one key a bundler cannot rename. */
function declaredBy(fronds: readonly FrondDescriptor[]): Map<Function, Declared> {
  const declared = new Map<Function, Declared>();
  for (const frond of fronds) {
    const entries = [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors, ...frond.middlewares];
    for (const { ctor, filePath } of entries) declared.set(ctor, { frond: frond.name, filePath });
  }

  return declared;
}

/**
 * What a constructor asks for and nothing where it is built answers — refused at boot rather than
 * at its first call, once the extensions have risen, since `up` registers too.
 */
export function unregistered(container: Container, fronds: readonly FrondDescriptor[]): Diagnostic[] {
  const declared = declaredBy(fronds);
  const seen = new Set<string>();

  return container.unresolved().flatMap(({ ctor, missing }) => {
    const subject = ctor.name;
    if (seen.has(`${subject}→${missing}`)) return [];
    seen.add(`${subject}→${missing}`);
    const where = declared.get(ctor);

    return [{
      severity: 'blocking' as const,
      code: 'dependency-unregistered',
      ...(where ? { frond: where.frond } : {}),
      subject,
      filePath: where?.filePath ?? '',
      message: `${subject} asks for ${missing}, and nothing ${where ? `in frond '${where.frond}' or above it ` : ''}answers that name. `
        + `A class of that name in a convention directory, or one extending it, would.`,
    }];
  });
}
