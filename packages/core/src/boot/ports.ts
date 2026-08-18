import type { ProviderEntry } from '../scan/frond.js';

/**
 * A port is a provider class that another provider extends. Nothing declares one —
 * the prototype chain states it, so `class StripePayment extends Payment` IS the
 * whole registration.
 *
 * This is the fourth reading of the rule the other three already apply: the type
 * names the SUBJECT (`EntityOrm<E>`, `Emit<F>`, `Facade<H>`) and the container
 * holds the realization. Providers were the one case where the type named the
 * realization instead, so `constructor(private payment: Payment)` resolved to the
 * base class and a handler got an object whose method did not exist.
 *
 * Only the DIRECT base binds. A deeper chain binds each link to its own child, and
 * a case that wants otherwise states it in `ports:` — which wins over all of this.
 */
export function portBindings(
  providers: ProviderEntry[],
  chosen: Record<string, string> | undefined,
): Map<string, ProviderEntry> {
  const scanned = new Map(providers.map((p) => [p.ctor.name, p]));

  // port class name → the classes that extend it, in scan order.
  const candidates = new Map<string, ProviderEntry[]>();
  for (const provider of providers) {
    const base = Object.getPrototypeOf(provider.ctor) as { name?: string } | null;
    const port = base?.name;
    // `!scanned.has(port)` also drops what a prefab fabricates: a repository extends
    // the class `Repository(Post)` returned, which is no file and therefore no port.
    if (!port || !scanned.has(port)) continue;
    candidates.set(port, [...(candidates.get(port) ?? []), provider]);
  }

  const bound = new Map<string, ProviderEntry>();
  for (const [port, impls] of candidates) {
    const named = chosen?.[port];
    if (named) {
      const pick = impls.find((i) => i.ctor.name === named);
      if (!pick) {
        throw new Error(
          `[ports] ${port}: '${named}' does not extend it. `
          + `What does: ${impls.map((i) => i.ctor.name).join(', ')}.`,
        );
      }
      bound.set(port, pick);
      continue;
    }
    if (impls.length > 1) {
      // Refusing rather than keeping one, for the reason `remotes` refuses two owners
      // of an entity: whichever won would depend on scan order, and the handler would
      // charge the wrong provider without a word.
      throw new Error(
        `[ports] ${impls.map((i) => i.ctor.name).join(' and ')} both extend ${port}, `
        + 'and nothing says which one answers it. Which realization a deployment uses is '
        + `not a fact about the code — state it: ports: { ${port}: '${impls[0].ctor.name}' } `
        + 'in fougere.config.ts.',
      );
    }
    bound.set(port, impls[0]);
  }
  return bound;
}
