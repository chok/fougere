import { answeringAtDoor, doorStepOf } from './doors.js';
import { nameOf } from '../descriptor/FrondDescriptor.js';
import { type ProviderEntry } from '../descriptor/ProviderEntry.js';
import { basesOf } from '../descriptor/bases.js';
import type { Diagnostic } from '../diagnostic.js';

/**
 * The ports whose realization is handed in rather than scanned.
 *
 * Documented: [ports](https://fougere.dev/docs/concepts/port).
 */
export const HOST_PORTS = new Set(['Storage']);

/** Where a chain of wrappers finds what the scope already answered under its port — a builtin's own instance. */
export const ownKeyOf = (port: string): string => `held:${port}`;

/** What stands in front of each host port, outermost first. */
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
  for (const link of [...links].reverse()) {
    const Link = linkOf(link, hostPort) as unknown as new (...args: unknown[]) => T;
    current = new Link(...link.deps.map((dep) => (dep === hostPort ? current : resolve(dep))));
  }

  return current;
}

/** The class a link is built from, forwarding to `inner` what it does not define. */
export function linkOf(link: ProviderEntry, port: string): ProviderEntry['ctor'] {
  const at = link.deps.indexOf(port);
  const forwards = link.implements?.includes(port) === true && at >= 0;
  const atDoor = doorStepOf(port);
  if (!forwards && !atDoor) return link.ctor;

  const Link = link.ctor as unknown as new (...args: unknown[]) => object;
  const Forwarding = class extends Link {
    constructor(...args: unknown[]) {
      super(...args);
      if (forwards) forward(this, args[at]);
      if (atDoor) answeringAtDoor(this, atDoor);
    }
  };
  Object.defineProperty(Forwarding, 'name', { value: Link.name });

  return Forwarding as unknown as ProviderEntry['ctor'];
}

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

/** Per port, the chain from the outside in; the last entry is the realization. */
export function portBindings(
  providers: ProviderEntry[],
  answers: (name: string) => boolean,
  chosen: Record<string, string | readonly string[]> | undefined,
  refused: Diagnostic[],
): Map<string, ProviderEntry[]> {
  const candidates = basesOf(providers, answers);

  const bound = new Map<string, ProviderEntry[]>();
  for (const [port, all] of candidates) {
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
