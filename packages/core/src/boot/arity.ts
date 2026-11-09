import { seatOf } from '../prefab/Repository.js';
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';

interface Constructed {
  ctor: { name: string; length: number };
  deps: string[];
  filePath: string;
}

/** Refuses a constructor that takes more arguments than its `deps`. */
export function refuseArityDrift(frond: FrondDescriptor, refused: Diagnostic[]): void {
  const constructed: Constructed[] = [
    ...frond.handlers,
    ...frond.presenters,
    ...frond.collectors,
    ...frond.providers,
  ];

  for (const { ctor: built, deps: given, filePath } of constructed) {
    const handed = seatOf(built).length;
    const ctor = { name: built.name, length: built.length - handed };
    const deps = given.slice(0, given.length - handed);
    if (ctor.length <= deps.length) continue;

    refused.push({
      severity: 'blocking',
      code: 'constructor-arity',
      filePath,
      frond: frond.name,
      subject: ctor.name,
      message: `${ctor.name}'s constructor takes ${ctor.length} parameter(s), but only ${deps.length} `
        + `${deps.length === 1 ? 'is' : 'are'} typed (${deps.join(', ') || 'none'}). Type each parameter, `
        + 'or the others receive undefined.',
    });
  }
}
