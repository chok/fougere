import { nameOf, type ProviderEntry } from '../descriptor/frond.js';

/**
 * A port is a class something already answers under, and what answers it may be a CHAIN:
 * the realization, wrapped by whoever stands in front of it.
 *
 * A wrapper is recognized by its FORM — it extends the port AND asks for it. Nothing
 * declares it, the way nothing declares a realization.
 *
 * Returns, per port, the chain from the OUTSIDE IN: the last entry is the realization,
 * every one before it wraps what follows.
 */
export function portBindings(
  providers: ProviderEntry[],
  answers: (name: string) => boolean,
  chosen: Record<string, string | readonly string[]> | undefined,
): Map<string, ProviderEntry[]> {
  // port class name → the classes that extend it, in scan order.
  const candidates = new Map<string, ProviderEntry[]>();
  for (const provider of providers) {
    const base = Object.getPrototypeOf(provider.ctor) as { name?: string } | null;
    const port = base?.name;
    // ONE condition: something already answers under that name. Providers are
    // registered into this scope just above, and the builtins sit in its parent, so
    // this covers a neighbour service and `Logger` alike — a framework class is a
    // port like any other, which is what makes a default overridable.
    //
    // It is also what excludes a prefab: a repository extends the class
    // `Repository(Post)` returned (`RepositoryBase`), and no key is ever that name.
    if (!port || !answers(port)) continue;
    candidates.set(port, [...(candidates.get(port) ?? []), provider]);
  }

  const bound = new Map<string, ProviderEntry[]>();
  for (const [port, all] of candidates) {
    /** It extends the port and asks for it: it stands in front of what answers. */
    const wraps = (one: ProviderEntry) => one.deps.includes(port);
    const wrappers = all.filter(wraps);
    const impls = all.filter((one) => !wraps(one));
    const stated = chosen?.[port];

    bound.set(port, chain(port, impls, wrappers, stated));
  }

  return bound;
}

function chain(
  port: string,
  impls: ProviderEntry[],
  wrappers: ProviderEntry[],
  stated: string | readonly string[] | undefined,
): ProviderEntry[] {
  // The whole chain, outside in — a string is a chain of one, and the last name is what
  // actually answers. What a deployment wraps its realization with is the same kind of
  // decision as which realization it uses, so it is the same key.
  if (stated !== undefined) {
    const order = typeof stated === 'string' ? [stated] : stated;
    const all = [...wrappers, ...impls];

    return order.map((name) => {
      const pick = all.find((one) => nameOf(one) === name);
      if (!pick) {
        throw new Error(
          `[ports] ${port}: '${name}' does not extend it. `
          + `What does: ${all.map(nameOf).join(', ')}.`,
        );
      }

      return pick;
    });
  }

  if (impls.length > 1) {
    // Refusing rather than keeping one, for the reason `remotes` refuses two owners
    // of an entity: whichever won would depend on scan order, and the handler would
    // charge the wrong provider without a word.
    throw new Error(
      `[ports] ${impls.map(nameOf).join(' and ')} both extend ${port}, `
      + 'and nothing says which one answers it. Which realization a deployment uses is '
      + `not a fact about the code — state it: ports: { ${port}: '${nameOf(impls[0]!)}' } `
      + 'in fougere.config.ts.',
    );
  }

  if (wrappers.length > 1) {
    // Same refusal one layer out: two wrappers are an ORDER, and scan order is not one.
    throw new Error(
      `[ports] ${wrappers.map(nameOf).join(' and ')} both wrap ${port}, `
      + 'and nothing says which stands in front. State the chain, outside in: '
      + `ports: { ${port}: [${[...wrappers, ...impls].map((one) => `'${nameOf(one)}'`).join(', ')}] } `
      + 'in fougere.config.ts.',
    );
  }

  return [...wrappers, ...impls];
}
