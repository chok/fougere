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

  /**
   * So an app can answer a `generate:` name this process never shipped.
   * FR : pour qu'une application réponde à un `generate:` non livré ici.
   * `Generators.register('ulid', ulid)` → `create: { generate: 'ulid' }` now resolves
   */
  static register(name: string, fn: () => string): void {
    this.registry.set(name, fn);
  }

  /**
   * So an unknown name is refused inside the registry, the only thing that knows what it holds.
   * FR : pour qu'un nom inconnu soit refusé dans le registre, seul à savoir.
   * `Generators.resolve('ulid')`, unregistered
   * → throws `Unknown generator 'ulid' … This process answers cuid2, uuid, nanoid.`
   */
  static resolve(ref: GeneratorRef): () => string {
    const found = this.registry.get(ref);
    if (found) return found;
    throw new Error(
      `Unknown generator '${ref}' — register it with Generators.register('${ref}', fn). ` +
      `This process answers ${[...this.registry.keys()].join(', ')}.`,
    );
  }

  /**
   * So a check can ask without throwing — reporting a gap is not the same as stopping a boot.
   * FR : pour qu'un contrôle demande sans lever — signaler n'est pas arrêter.
   * `Generators.answers('cuid2')` → `true`
   */
  static answers(ref: GeneratorRef): boolean {
    return this.registry.has(ref);
  }
}
