import { type ProviderEntry } from './ProviderEntry.js';

/**
 * Port class name → every concrete class below it, in scan order.
 *
 * ONE condition, and the caller owns it: something already answers under that name. The boot
 * asks its container, where the providers sit in the frond's scope and the builtins in its
 * parent — so a neighbour service and `Logger` both count, a framework class being a port like
 * any other, which is what makes a default overridable.
 *
 * A provider is ranked under the highest ancestor that answers AND under every class it crossed
 * to reach it: a class something extends is a port, declared or not. `StripePayment extends
 * CardPayment extends Payment` answers both, so an abstract `CardPayment` nobody registers is
 * still a key, and a DECLARED abstract one is never a candidate. A wrapper stops at the class it asks for — it stands in front of that one and
 * realizes nothing above it.
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
    if (provider.abstract) continue;
    for (const port of portsOf(provider, answers)) bases.set(port, [...(bases.get(port) ?? []), provider]);
  }

  return bases;
}

/** The ancestors a provider answers under, nearest first, up to the last one that answers. */
function portsOf(provider: ProviderEntry, answers: (name: string) => boolean): string[] {
  const crossed: string[] = [];
  for (let base = Object.getPrototypeOf(provider.ctor) as { name?: string } | null; base?.name; base = Object.getPrototypeOf(base) as { name?: string } | null) {
    if (provider.deps.includes(base.name)) return [base.name];
    crossed.push(base.name);
  }
  const last = crossed.findLastIndex(answers);

  return crossed.slice(0, last + 1);
}
