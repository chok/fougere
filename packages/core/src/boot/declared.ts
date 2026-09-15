/**
 * What an app says about its NEIGHBOURS — the dual of the identity card, which says what it IS.
 *
 * Documented: [observability](https://fougere.dev/docs/infra/observability).
 */
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { facadeKeyOf } from '../wire/Facade.js';
import { factsAnnouncedBy, factsAwaitedBy, factsListenedTo } from '../wire/Emit.js';
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
    // A frond its family inherits from answers at no address, so it has no placement to
    // report: it stands in every process that holds one of its children.
    .filter((frond) => frond.handlers.length > 0)
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

/**
 * The two ways a call leaves a frond: a façade its code names, and a fact it announces.
 *
 * The second cannot be read the way the first is. A dependency names what it reaches, where an
 * announcement names a SUBJECT and a subscriber names nothing at all — so the edge is found from
 * both ends, the announcer's deps and the listener's binding plan. Reading the deps alone
 * reported `demos/pipe-split` as four fronds with nothing between them, and three of its four
 * fronds are reached by a fact.
 */
function crossings(hosted: readonly FrondDescriptor[]): DeclaredEdge[] {
  const index = servedBy(hosted);
  const heard = listenedBy(hosted);
  const found = new Map<string, DeclaredEdge>();
  const cross = (from: string, to: string) => {
    if (from !== to) found.set(`${from} ${to}`, { from, to });
  };

  for (const frond of hosted) {
    for (const handler of frond.handlers) {
      for (const to of reachedBy(handler.deps, frond.name, index)) cross(frond.name, to);
    }
    for (const fact of announcedIn(frond)) {
      for (const to of heard.get(fact) ?? []) cross(frond.name, to);
    }
  }

  return [...found.values()];
}

/** Which fronds listen to each fact — every one of them, since an announcement names no recipient. */
function listenedBy(hosted: readonly FrondDescriptor[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const frond of hosted) {
    for (const fact of factsListenedTo(frond.handlers)) {
      index.set(fact, [...(index.get(fact) ?? []), frond.name]);
    }
  }

  return index;
}

/** A fact announced here, whether the announcer waits for an answer or not. */
function announcedIn(frond: FrondDescriptor): string[] {
  return [...new Set([...factsAnnouncedBy(frond.handlers), ...factsAwaitedBy(frond.handlers)])];
}

function hostOf(address: string): string {
  try {
    const url = new URL(address);

    return `${url.protocol}//${url.host}`;
  } catch {
    return address;
  }
}
