import type { Container } from '@fougere/container';
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { SEAMS } from './ports.js';

/**
 * What a constructor asks for and nothing where it is built answers — refused at boot rather than
 * at its first call, once the extensions have risen, since `up` registers too. Read off what each
 * class DECLARES, in the scope of the frond that declares it. A seam is answered by the link that
 * wraps it, and a facade another process serves by the stand-in `answeredElsewhere` names.
 */
export function unregistered(
  container: Container,
  fronds: readonly FrondDescriptor[],
  answeredElsewhere: (name: string) => boolean,
): Diagnostic[] {
  const refused = new Map<string, Diagnostic>();
  for (const frond of fronds) {
    if (!container.has(`frond:${frond.name}`)) continue;
    const scope = container.resolve<Container>(`frond:${frond.name}`);
    const declared = [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors, ...frond.middlewares];
    for (const { ctor, deps, filePath } of declared) {
      for (const missing of deps) {
        if (scope.has(missing) || SEAMS.has(missing) || answeredElsewhere(missing)) continue;
        if (refused.has(`${ctor.name}→${missing}`)) continue;
        refused.set(`${ctor.name}→${missing}`, {
          severity: 'blocking',
          code: 'dependency-unregistered',
          frond: frond.name,
          subject: ctor.name,
          filePath,
          message: `${ctor.name} asks for ${missing}, and nothing in frond '${frond.name}' or above it answers that name. `
            + `A class of that name in a convention directory, or one extending it, would.`,
        });
      }
    }
  }

  return [...refused.values()];
}
