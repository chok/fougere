import type { Container } from '@fougere/container';
import { directoryOf, resolveConventions, type Conventions } from '../Conventions.js';
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { HOST_PORTS } from './ports.js';

/**
 * What a constructor asks for and nothing where it is built answers — refused at boot rather than
 * at its first call, once the extensions have risen, since `up` registers too. Read off what each
 * class DECLARES, in the scope of the frond that declares it. A seam is answered by the link that
 * wraps it, and a facade another process serves by the stand-in `facadeServedRemotely` names.
 */
export function unregistered(
  container: Container,
  fronds: readonly FrondDescriptor[],
  facadeServedRemotely: (name: string) => boolean,
  conventions: Conventions = resolveConventions(),
): Diagnostic[] {
  const refused = new Map<string, Diagnostic>();
  const handlerFrond = new Map(fronds.flatMap((frond) => frond.handlers.map((handler) => [handler.name, frond.name] as const)));
  for (const frond of fronds) {
    if (!container.has(`frond:${frond.name}`)) continue;
    const scope = container.resolve<Container>(`frond:${frond.name}`);
    const declared = [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors, ...frond.middlewares];
    for (const { ctor, deps, filePath } of declared) {
      for (const missing of deps) {
        if (scope.has(missing) || HOST_PORTS.has(missing) || facadeServedRemotely(missing)) continue;
        if (refused.has(`${ctor.name}→${missing}`)) continue;
        const across = handlerFrond.get(missing);
        if (across) {
          refused.set(`${ctor.name}→${missing}`, {
            severity: 'blocking',
            code: 'handler-of-another-frond',
            frond: frond.name,
            subject: ctor.name,
            filePath,
            message: `${ctor.name} asks for ${missing}, a handler of the frond '${across}'. A handler is handed only inside its own `
              + `frond: from another one, ask for its facade — Facade<${missing}> — which validates, runs the middlewares and `
              + 'crosses a process when the frond moves.',
          });
          continue;
        }
        refused.set(`${ctor.name}→${missing}`, {
          severity: 'blocking',
          code: 'dependency-unregistered',
          frond: frond.name,
          subject: ctor.name,
          filePath,
          message: `${ctor.name} asks for ${missing}, and nothing in the frond '${frond.name}' provides it. `
            + `Add a class named ${missing} in ${directoryOf(frond.name, 'services', conventions)}, or check the spelling.`,
        });
      }
    }
  }

  return [...refused.values()];
}
