import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import { facadeKeyOf } from '../../wire/Facade.js';
import { factsAnnouncedBy, factsAwaitedBy, factsListenedTo } from '../../wire/Emit.js';
import { type DeclaredEdge } from '../../wire/topology/DeclaredEdge.js';
import { type DeclaredFrond } from '../../wire/topology/DeclaredFrond.js';
import { type DeclaredTopology } from '../../wire/topology/DeclaredTopology.js';

interface Declaring {
  fronds: readonly FrondDescriptor[];
  remotes: Readonly<Record<string, string>>;
}

/** Read from the config and the scan, never from a call, so nothing has to answer for it. */
export function declaredTopologyOf({ fronds, remotes }: Declaring): DeclaredTopology {
  const hosted = fronds.filter((frond) => !frond.fromExtension);

  return { fronds: placements(hosted, remotes), edges: crossings(hosted) };
}

function placements(hosted: readonly FrondDescriptor[], remotes: Readonly<Record<string, string>>): DeclaredFrond[] {
  const here = hosted
    .filter((frond) => frond.handlers.length > 0)
    .filter((frond) => !remotes[frond.name])
    .map((frond) => ({ frond: frond.name, placement: 'local' as const }));

  const remote = Object.entries(remotes)
    .map(([frond, address]) => ({ frond, placement: 'remote' as const, at: hostOf(address) }));

  return [...here, ...remote];
}

/** Which frond serves each address. */
export function servedBy(fronds: readonly FrondDescriptor[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const frond of fronds) {
    if (frond.fromExtension) continue;
    for (const handler of frond.handlers) {
      if (handler.surface) continue;
      index.set(facadeKeyOf(handler.address), frond.name);
    }
  }

  return index;
}

/** The fronds one class reaches through a façade. */
export function reachedBy(deps: readonly string[], from: string, index: Map<string, string>): string[] {
  const reached = deps
    .map((dependency) => index.get(dependency))
    .filter((frond): frond is string => frond !== undefined && frond !== from);

  return [...new Set(reached)];
}

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

function listenedBy(hosted: readonly FrondDescriptor[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const frond of hosted) {
    for (const fact of factsListenedTo(frond.handlers)) {
      index.set(fact, [...(index.get(fact) ?? []), frond.name]);
    }
  }

  return index;
}

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
