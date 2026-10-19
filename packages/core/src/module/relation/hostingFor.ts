import type { Container } from '@fougere/container';
import type { Graph } from '@fougere/graph';
import type { SchemaView } from '@fougere/schema';
import type { Fronds } from '../../descriptor/Fronds.js';
import type { Storage } from '../../storage/Storage.js';
import { Invocation } from '../../wire/Invocation.js';
import { RPC_ADDRESS } from '../../wire/RpcAnswer.js';
import type { Transport } from '../../wire/Transport.js';
import type { Constraint } from '../../Constraint.js';
import type { Hosting } from './Hosting.js';
import { JOURNAL, type Journal } from './Journal.js';
import type { Peer } from './Peer.js';
import { peerOver } from './peerOver.js';
import { relationGraph } from './relationGraph.js';

/** Where the process serving an entity answers — what the remote router hands a release. */
export interface Routing {
  route(address: string): Promise<{ transport: Transport }>;
}

export interface Hosted {
  fronds: Fronds;
  container: Container;
  /** The placement half of the app's options — where each frond answers, and what each source keeps. */
  options: {
    remotes?: Record<string, string>;
    remoteTransport?: (url: string) => Transport;
    sourceOf?: (entityName: string) => string;
    enforces?: (source: string, constraint: Constraint) => boolean;
  };
  remoteRouter: Routing | undefined;
  entityByName: Map<string, SchemaView>;
  frondOf: Map<string, string>;
  storageOf: (entity: string) => Storage | undefined;
}

/** The process that serves an entity, asked the three questions a release travels on. */
function peerBehind(entity: string, router: Routing): Peer {
  const ask = async (op: string, params: Record<string, unknown>): Promise<unknown> =>
    (await router.route(entity)).transport(
      { address: RPC_ADDRESS, op },
      { ...Invocation.empty, params: params as never },
    );

  return {
    dependents: async (named) => await ask('dependents', { entity: named }) as never,
    missing: async (named, keys) =>
      (await ask('holds', { entity: named, keys }) as { missing: readonly unknown[] }).missing,
    release: async (named, key) => { await ask('release', { entity: named, key }); },
  };
}

export function hostingFor(
  { fronds, container, options, remoteRouter, entityByName, frondOf, storageOf }: Hosted,
): { hosting: Hosting; journalOf: () => Journal | undefined } {
  // What carries a release writes none: an instrumentation frond's own rows are kept while a
  // release happens, and journalling them would begin one inside the one being written down.
  const carriesRelease = new Set(
    fronds.filter((one) => one.brought).flatMap((one) => one.entities.map((entity) => entity.name)),
  );

  /**
   * The journal a package registered, found where its own frond put it — a provider lands in its
   * frond's scope, and the app container sees none of them. Resolved per call and never at boot:
   * the package that registers it rises in the ascent, long after this answer is built.
   */
  const journalOf = (): Journal | undefined => {
    for (const frond of fronds) {
      if (!frond.brought) continue;
      const scope = container.resolve<Container>(`frond:${frond.name}`);
      if (scope.has(JOURNAL)) return scope.resolve<Journal>(JOURNAL);
    }

    return undefined;
  };

  let relations: Graph | undefined;

  const hosting: Hosting = {
    hostedHere: (entity) => !(options.remotes && (frondOf.get(entity) ?? '') in options.remotes),
    sourceOf: (name) => options.sourceOf?.(name) ?? 'default',
    enforces: (source, constraint) => options.enforces?.(source, constraint) ?? false,
    storageOf,
    entities: () => entityByName,
    relations: () => (relations ??= relationGraph(entityByName)),
    journal: (entity) => (carriesRelease.has(entity) ? undefined : journalOf()),
    // Built from `remotes:` itself and not from the router: the router indexes by ENTITY, read
    // off a card, while the question here is asked of a PROCESS about rows it may be alone in
    // knowing about. Nothing is cached — a peer that was down at boot answers the next call.
    peers: () => (options.remoteTransport
      ? Object.values(options.remotes ?? {}).map((url) => peerOver(options.remoteTransport!(url)))
      : []),
    peerOf: (entity) => (remoteRouter ? peerBehind(entity, remoteRouter) : undefined),
  };

  return { hosting, journalOf };
}
