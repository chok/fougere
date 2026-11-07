import { createId } from '@paralleldrive/cuid2';
import { uuidv7 } from 'uuidv7';

import { Registry } from '@fougere/registry';

export type GeneratorRef = 'uuidv7' | 'uuid' | 'cuid2' | (string & {});

/**
 * Who answers a `generate:` name.
 * Ex: `Generators.register('nanoid', nanoid)`.
 */
export const Generators = new Registry<() => string>(
  'generator',
  'export Generators.term(name, fn) from a file in vocabulary/',
  [
    ['uuidv7', uuidv7],
    ['uuid', () => globalThis.crypto.randomUUID()],
    ['cuid2', createId],
  ],
);

/** The generators whose ids are UUIDs — what an engine with a `uuid` type can store as one. */
export const UUID_GENERATORS: ReadonlySet<string> = new Set(['uuidv7', 'uuid']);
