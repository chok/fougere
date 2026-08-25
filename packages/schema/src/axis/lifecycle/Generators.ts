import { createId } from '@paralleldrive/cuid2';

export type GeneratorRef = 'cuid2' | 'uuid' | 'nanoid' | (string & {});

const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function nanoid(): string {
  const bytes = new Uint8Array(21);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => NANOID_ALPHABET[byte & 63]).join('');
}

/**
 * Who answers a `generate` by name — one registry per process, like `Formats` and
 * `Boundaries`.
 *
 * The three builtins are REGISTERED rather than switched on, which is what brings the
 * refusal back inside: a registry whose unknown name is refused by a `default:` branch in
 * its caller does not know what it holds, so it cannot say so.
 */
export class Generators {
  private static readonly registry = new Map<string, () => string>([
    ['cuid2', createId],
    ['uuid', () => globalThis.crypto.randomUUID()],
    ['nanoid', nanoid],
  ]);

  static register(name: string, fn: () => string): void {
    this.registry.set(name, fn);
  }

  /** The generator this name stands for, refused by name when nothing does. */
  static resolve(ref: GeneratorRef): () => string {
    const found = this.registry.get(ref);
    if (found) return found;
    throw new Error(
      `Unknown generator '${ref}' — register it with Generators.register('${ref}', fn). ` +
      `This process answers ${[...this.registry.keys()].join(', ')}.`,
    );
  }

  /** Whether a name is answered, for a caller that must not throw to find out. */
  static holds(ref: GeneratorRef): boolean {
    return this.registry.has(ref);
  }
}
