import { createId } from '@paralleldrive/cuid2';

import { Registry } from '@fougere/registry';

export type GeneratorRef = 'cuid2' | (string & {});

/**
 * Who answers a `generate:` name. `cuid2` is registered like any other, so
 * `Generators.resolve('uuid')` is refused here and names what the process holds.
 * `Generators.register('uuid', () => globalThis.crypto.randomUUID())` →
 * `create: { generate: 'uuid' }` now resolves
 */
export const Generators = new Registry<() => string>(
  'generator',
  "export Generators.term(name, fn) from a vocabulary/ file and list it in the statement's `vocabulary`",
  [['cuid2', createId]],
);
