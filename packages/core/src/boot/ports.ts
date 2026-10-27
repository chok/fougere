import { nameOf } from '../descriptor/FrondDescriptor.js';
import { type ProviderEntry } from '../descriptor/ProviderEntry.js';
import { basesOf } from '../descriptor/bases.js';
import type { Diagnostic } from '../diagnostic.js';

/**
 * The framework's own ports — a class core exports that a user class may stand in front of.
 *
 * They differ from a port in one way, and it decides everything else: their realization is
 * HANDED IN rather than scanned (`storageFactory` builds one per entity), so a class that
 * extends one can only be a wrapper.
 *
 * The scope is the FROND, like every other provider, and there is no key that widens it: a
 * link that must be everywhere is a frond that is everywhere, which `Extension.fronds`
 * already answers — `@fougere/calls` brings one into every app that installs it. A
 * process-wide key would break the gradient, since a frond moved behind `remotes:` would
 * silently leave the reach of a link its own code never mentioned.
 *
 * Documented: [ports](https://fougere.dev/docs/business/ports).
 */
export const HOST_PORTS = new Set(['Storage']);

/** Where a chain of wrappers finds what the scope already answered under its port — a builtin's own instance. */
export const ownKeyOf = (port: string): string => `held:${port}`;

/**
 * What stands in front of each seam, outermost first — the same reading `portBindings`
 * does, with no realization to find.
 */
export function hostPortChains(
  providers: ProviderEntry[],
  chosen: Record<string, string | readonly string[]> | undefined,
  refused: Diagnostic[],
): Map<string, ProviderEntry[]> {
  const wrappers = new Map<string, ProviderEntry[]>();
  for (const provider of providers) {
    const implemented = provider.implements?.find((port) => HOST_PORTS.has(port));
    const hostPort = implemented ?? (Object.getPrototypeOf(provider.ctor) as { name?: string } | null)?.name;
    if (!hostPort || !HOST_PORTS.has(hostPort)) continue;
    if (!provider.deps.includes(hostPort)) {
      refused.push({
        severity: 'blocking',
        code: 'seam-not-wrapped',
        filePath: provider.filePath,
        subject: nameOf(provider),
        message: `${nameOf(provider)} extends ${hostPort} but takes no ${hostPort}. To wrap it, take it: `
          + `constructor(private inner: ${hostPort}). To keep rows somewhere new, register a source type instead (Sources.register).`,
      });
      continue;
    }
    wrappers.set(hostPort, [...(wrappers.get(hostPort) ?? []), provider]);
  }

  const bound = new Map<string, ProviderEntry[]>();
  for (const [seam, all] of wrappers) bound.set(seam, chain(seam, [], all, chosen?.[seam], refused));

  return bound;
}

/** Put the declared chain in front of an instance the framework holds, and hand back the outermost. */
export function wrapping<T extends object>(
  hostPort: string,
  links: readonly ProviderEntry[],
  inner: T,
  resolve: (name: string) => unknown,
): T {
  let current = inner;
  // From the INSIDE out, so each link is handed the one it stands in front of — the same
  // order `install.ts` registers a port's chain in, for the same reason.
  for (const link of [...links].reverse()) {
    const Link = linkOf(link, hostPort) as unknown as new (...args: unknown[]) => T;
    current = new Link(...link.deps.map((dep) => (dep === hostPort ? current : resolve(dep))));
  }

  return current;
}

/**
 * The class a link is built from. One that `implements Partial<Port>` writes only what it changes,
 * so the rest of the port is handed to the `inner` it was given — once, as it is built, and only
 * what it does not define itself. One that extends the port inherits the rest already.
 */
export function linkOf(link: ProviderEntry, port: string): ProviderEntry['ctor'] {
  const at = link.deps.indexOf(port);
  if (!link.implements?.includes(port) || at < 0) return link.ctor;

  const Link = link.ctor as unknown as new (...args: unknown[]) => object;
  const Forwarding = class extends Link {
    constructor(...args: unknown[]) {
      super(...args);
      forward(this, args[at]);
    }
  };
  Object.defineProperty(Forwarding, 'name', { value: Link.name });

  return Forwarding as unknown as ProviderEntry['ctor'];
}

/** Every method of `inner` the link does not define, called on `inner`. */
function forward(link: object, inner: unknown): void {
  if (!inner || typeof inner !== 'object') return;
  for (let level = Object.getPrototypeOf(inner); level && level !== Object.prototype; level = Object.getPrototypeOf(level)) {
    for (const name of Object.getOwnPropertyNames(level)) {
      if (name === 'constructor' || name in link) continue;
      const method = (inner as Record<string, unknown>)[name];
      if (typeof method !== 'function') continue;
      Object.defineProperty(link, name, { value: (method as (...args: unknown[]) => unknown).bind(inner), configurable: true });
    }
  }
}

/**
 * A port is a class something already answers under, and what answers it may be a CHAIN:
 * the realization, wrapped by whoever stands in front of it.
 *
 * A wrapper DECLARES the port — it extends it, or `implements Partial<Port>` — AND asks for it.
 * Nothing more declares it, the way nothing declares a realization.
 *
 * Returns, per port, the chain from the OUTSIDE IN: the last entry is the realization,
 * every one before it wraps what follows.
 */
export function portBindings(
  providers: ProviderEntry[],
  answers: (name: string) => boolean,
  chosen: Record<string, string | readonly string[]> | undefined,
  refused: Diagnostic[],
): Map<string, ProviderEntry[]> {
  const candidates = basesOf(providers, answers);

  const bound = new Map<string, ProviderEntry[]>();
  for (const [port, all] of candidates) {
    /** It extends the port and asks for it: it stands in front of what answers. */
    const wraps = (one: ProviderEntry) => one.deps.includes(port);
    const wrappers = all.filter(wraps);
    const impls = all.filter((one) => !wraps(one));
    const declared = chosen?.[port];

    bound.set(port, chain(port, impls, wrappers, declared, refused));
  }

  return bound;
}

function chain(
  port: string,
  impls: ProviderEntry[],
  wrappers: ProviderEntry[],
  declared: string | readonly string[] | undefined,
  refused: Diagnostic[],
): ProviderEntry[] {
  if (declared !== undefined) return declaredChain(port, [...wrappers, ...impls], declared, refused);

  refuseUndecided(port, impls, wrappers, refused);

  return [...wrappers, ...impls];
}

/**
 * The whole chain, outside in — a string is a chain of one, and the last name is what actually
 * answers. What a deployment wraps its realization with is the same kind of decision as which
 * realization it uses, so it is the same key.
 */
function declaredChain(
  port: string,
  all: ProviderEntry[],
  declared: string | readonly string[],
  refused: Diagnostic[],
): ProviderEntry[] {
  const order = typeof declared === 'string' ? [declared] : declared;

  return order.flatMap((name) => {
    const pick = all.find((one) => nameOf(one) === name);
    if (pick) return [pick];

    refused.push({
      severity: 'blocking',
      code: 'port-not-extended',
      filePath: all[0]?.filePath ?? 'fougere.config.ts',
      subject: `ports: { ${port}: '${name}' }`,
      message: `No class ${name} extends or implements ${port}. These do: ${all.map(nameOf).join(', ')}.`,
    });

    return [];
  });
}

/**
 * Two realizations, or two wrappers, and nothing saying which — refused rather than settled by
 * scan order, the same reason `remotes` refuses two owners of one entity: whichever won would
 * depend on the order files were read, and the handler would charge the wrong provider silently.
 */
function refuseUndecided(
  port: string,
  impls: ProviderEntry[],
  wrappers: ProviderEntry[],
  refused: Diagnostic[],
): void {
  if (impls.length > 1) {
    refused.push({
      severity: 'blocking',
      code: 'port-implemented-twice',
      filePath: impls[0]!.filePath,
      subject: port,
      message: `${impls.map(nameOf).join(' and ')} both extend ${port}. Pick one in fougere.config.ts: `
        + `ports: { ${port}: '${nameOf(impls[0]!)}' }.`,
    });
  }

  if (wrappers.length > 1) {
    refused.push({
      severity: 'blocking',
      code: 'port-wrapped-twice',
      filePath: wrappers[0]!.filePath,
      subject: port,
      message: `${wrappers.map(nameOf).join(' and ')} both wrap ${port}. Give the order in fougere.config.ts, `
        + `outermost first: ports: { ${port}: [${[...wrappers, ...impls].map((one) => `'${nameOf(one)}'`).join(', ')}] }.`,
    });
  }
}
