import { createId } from '@paralleldrive/cuid2';

import { Registry } from '../../lib/Registry.js';

export type GeneratorRef = 'cuid2' | (string & {});

/**
 * Who answers a `generate:` name. `cuid2` is registered like any other, so
 * `Generators.resolve('uuid')` is refused here and names what the process holds.
 * `Generators.register('uuid', () => globalThis.crypto.randomUUID())` →
 * `create: { generate: 'uuid' }` now resolves
 */
export const Generators = new Registry<() => string>(
  'generator',
  'call Generators.register(name, fn)',
  [['cuid2', createId]],
);
