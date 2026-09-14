/**
 * What an app says about its NEIGHBOURS — the dual of the identity card, which says what it IS.
 *
 * Documented: [observability](https://fougere.dev/docs/infra/observability).
 */
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { facadeKeyOf } from '../wire/Facade.js';
import { type DeclaredEdge } from '../wire/topology/DeclaredEdge.js';
import { type DeclaredFrond } from '../wire/topology/DeclaredFrond.js';
import { type DeclaredTopology } from '../wire/topology/DeclaredTopology.js';

interface Declaring {
  fronds: readonly FrondDescriptor[];
  remotes: Readonly<Record<string, string>>;
}

/** Read from the config and the scan, never from a call, so nothing has to answer for it. */
export function declaredTopologyOf({ fronds, remotes }: Declaring): DeclaredTopology {
  const hosted = fronds.filter((frond) => !frond.brought);

  return { fronds: placements(hosted, remotes), edges: crossings(hosted) };
}

function placements(hosted: readonly FrondDescriptor[], remotes: Readonly<Record<string, string>>): DeclaredFrond[] {
  const here = hosted
    .filter((frond) => !remotes[frond.name])
    .map((frond) => ({ frond: frond.name, placement: 'local' as const }));

  const elsewhere = Object.entries(remotes)
    .map(([frond, address]) => ({ frond, placement: 'remote' as const, at: hostOf(address) }));

  return [...here, ...elsewhere];
}

/**
 * Which frond serves each address — indexed FORWARD, so a dependency is recognized by what
 * answers it and never by its spelling. A surface is left out: its key carries a `:`, and no
 * dependency can name one.
 */
export function servedBy(fronds: readonly FrondDescriptor[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const frond of fronds) {
    if (frond.brought) continue;
    for (const handler of frond.handlers) {
      if (handler.surface) continue;
      index.set(facadeKeyOf(handler.address), frond.name);
    }
  }

  return index;
}

/**
 * The fronds one class reaches through a façade — the only sanctioned crossing.
 *
 * An address no scanned frond serves is left out rather than guessed: naming the frond behind it
 * means reading its card, and a card is a DISCOVERY, which belongs to the other half of the
 * report. This answers what the CODE declares, and never more.
 */
export function reachedBy(deps: readonly string[], from: string, index: Map<string, string>): string[] {
  const reached = deps
    .map((dependency) => index.get(dependency))
    .filter((frond): frond is string => frond !== undefined && frond !== from);

  return [...new Set(reached)];
}

function crossings(hosted: readonly FrondDescriptor[]): DeclaredEdge[] {
  const index = servedBy(hosted);
  const found = new Map<string, DeclaredEdge>();

  for (const frond of hosted) {
    for (const handler of frond.handlers) {
      for (const to of reachedBy(handler.deps, frond.name, index)) {
        found.set(`${frond.name} ${to}`, { from: frond.name, to });
      }
    }
  }

  return [...found.values()];
}

function hostOf(address: string): string {
  try {
    const url = new URL(address);

    return `${url.protocol}//${url.host}`;
  } catch {
    return address;
  }
}
