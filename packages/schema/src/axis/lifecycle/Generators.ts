import { createId } from '@paralleldrive/cuid2';

import { Registry } from '../../lib/Registry.js';

export type GeneratorRef = 'cuid2' | 'uuid' | (string & {});

/**
 * Who answers a `generate:` name. `cuid2` and `uuid` are registered like any other, so
 * `Generators.resolve('ulid')` is refused here and lists the two.
 * FR : pour qu'un `generate:` soit répondu par un registre, builtins compris.
 * `Generators.register('ulid', ulid)` → `create: { generate: 'ulid' }` now resolves
 */
export const Generators = new Registry<() => string>(
  'generator',
  'call Generators.register(name, fn)',
  [
    ['cuid2', createId],
    ['uuid', () => globalThis.crypto.randomUUID()],
  ],
);
