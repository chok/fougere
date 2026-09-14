import { type ProviderEntry } from './ProviderEntry.js';

/**
 * Port class name → the classes that extend it, in scan order.
 *
 * ONE condition, and the caller owns it: something already answers under that name. The boot
 * asks its container, where the providers sit in the frond's scope and the builtins in its
 * parent — so a neighbour service and `Logger` both count, a framework class being a port like
 * any other, which is what makes a default overridable.
 *
 * It is also what excludes a prefab: a repository extends the class `Repository(Post)`
 * returned (`RepositoryBase`), and no key is ever that name.
 *
 * Read twice, which is why it is stated once: the boot binds against it, and the scan emits
 * the same relation as types so a config cannot name a class that does not answer the port.
 */
export function basesOf(
  providers: ProviderEntry[],
  answers: (name: string) => boolean,
): Map<string, ProviderEntry[]> {
  const bases = new Map<string, ProviderEntry[]>();
  for (const provider of providers) {
    const base = Object.getPrototypeOf(provider.ctor) as { name?: string } | null;
    const port = base?.name;
    if (!port || !answers(port)) continue;
    bases.set(port, [...(bases.get(port) ?? []), provider]);
  }

  return bases;
}
