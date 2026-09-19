import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';

interface Constructed {
  ctor: { name: string; length: number };
  deps: string[];
  filePath: string;
}

/**
 * What the container hands a constructor is `deps`, one argument per key and in order — so a
 * constructor asking for more is handed `undefined`. The scan reads `deps` off the signature and
 * cannot miss; a frond declared by hand can, and `Function.length` is the one thing a
 * constructor says about itself once the types are gone.
 *
 * `length` is a floor and never a count: a class that writes no constructor inherits
 * `(...args) => super(...args)`, which is 0, while the scan read its parent's dependencies.
 */
export function refuseArityDrift(frond: FrondDescriptor, refused: Diagnostic[]): void {
  const constructed: Constructed[] = [
    ...frond.handlers,
    ...frond.presenters,
    ...frond.collectors,
    ...frond.providers,
    ...frond.middlewares,
  ];

  for (const { ctor, deps, filePath } of constructed) {
    if (ctor.length <= deps.length) continue;

    refused.push({
      severity: 'blocking',
      code: 'constructor-arity',
      filePath,
      frond: frond.name,
      subject: ctor.name,
      message: `${ctor.name}'s constructor takes ${ctor.length} parameter(s) and ${deps.length} `
        + `dependenc${deps.length === 1 ? 'y is' : 'ies are'} declared (${deps.join(', ') || 'none'}) — `
        + 'the rest would be handed `undefined`.',
    });
  }
}
