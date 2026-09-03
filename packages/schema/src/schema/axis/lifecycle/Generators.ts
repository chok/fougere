import { createId } from '@paralleldrive/cuid2';

import { Registry } from '../../../Registry.js';

export type GeneratorRef = 'cuid2' | 'uuid' | 'nanoid' | (string & {});

const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function nanoid(): string {
  const bytes = new Uint8Array(21);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => NANOID_ALPHABET[byte & 63]).join('');
}

/**
 * Who answers a `generate:` name. `cuid2`, `uuid` and `nanoid` are registered like any
 * other, so `Generators.resolve('ulid')` is refused here and lists the three.
 * FR : pour qu'un `generate:` soit répondu par un registre, builtins compris.
 * `Generators.register('ulid', ulid)` → `create: { generate: 'ulid' }` now resolves
 */
export const Generators = new Registry<() => string>(
  'generator',
  'call Generators.register(name, fn)',
  [
    ['cuid2', createId],
    ['uuid', () => globalThis.crypto.randomUUID()],
    ['nanoid', nanoid],
  ],
);
