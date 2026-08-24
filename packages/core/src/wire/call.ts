/**
 * Call contract — a frond call is a value.
 *
 * (frond, entity, op, invocation) → result, or a thrown FougereError.
 * A transport is a function that executes this call elsewhere; the local
 * runner below is the reference realization. Transports move the value,
 * they never reshape it.
 */
import { Card, type SchemaDescriptor } from '@fougere/schema';
import { factsAnnouncedBy } from '../emit.js';
import type { InvocationContext } from './invocation.js';
import { FougereError, ErrorCode } from './errors.js';
import type { App } from '../boot/types.js';
import { createTransportEntry } from '../entry/TransportEntry.js';

/** Target of a call — which façade operation, wherever it lives. */
export interface FrondCall {
  /** Frond name, when the caller knows it. Routing hint only. */
  frond?: string;
  /** Entity registration key (e.g. 'product'). */
  entity: string;
  /** Façade operation name (e.g. 'findById', 'search'). */
  op: string;
}

/** A transport executes a call somewhere else. Failures surface as thrown FougereError. */
export type Transport = (call: FrondCall, invocation: InvocationContext) => Promise<unknown>;

/** Reserved namespace — calls the runner answers itself, never a façade. */
export const RPC_ENTITY = 'rpc';

/**
 * What an `rpc` op answers — the door for what the app says about ITSELF, never about a row.
 *
 * `discover` is core's own, registered like any other (`bootstrap.ts`): a package declares
 * its reading beside it, and an app that installed none serves none.
 */
export type RpcAnswer = (invocation: InvocationContext, surface?: string) => unknown;

/**
 * Everything a caller's envelope covers — the call as the sender meant it.
 *
 * Here and not beside the signing code because it is a CONTRACT: the sender binds it,
 * the receiver re-presents what arrived, and a frond written in another language reads
 * this shape without reading our crypto. `body` is bound by digest (arbitrary, possibly
 * large), the rest by value — which is what keeps a canonical-JSON dependency out.
 */
export interface SignedCall {
  entity: string;
  op: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  state?: Record<string, unknown>;
}

/**
 * One operation, as a stranger meets it — its name, what it is for, what it takes
 * and whether it reads or writes. Everything here already existed on the contract;
 * it just never left the process.
 */
export interface CardOp {
  name: string;
  /** The author's own doc sentence, when the method carries one. */
  description?: string;
  /** JSON Schema of what it accepts, when the contract names a view. */
  input?: SchemaDescriptor;
  /** JSON Schema of what it emits, when the contract names one. */
  output?: SchemaDescriptor;
  /** `query` reads, `command` writes — the same call REST turns into GET vs POST. */
  kind: 'query' | 'command';
  /**
   * How much `output` describes: one row, maybe one, many, a page, or nothing shaped.
   * `output` alone is the shape of a ROW, so a consumer generating a signature from
   * this card would otherwise have to guess — and `list` returning a page rather than
   * an array is exactly the guess it would get wrong.
   */
  cardinality?: 'one' | 'maybe' | 'many' | 'page' | 'none';
}

/**
 * What an app hosts — the wire projection of its scanned fronds.
 *
 * Two lists per frond, and they are duals: **what you may call**, and **what you will
 * receive**. A door is entered from outside; a fact leaves on its own.
 *
 * `doors` was called `entities` and the name lied: an entry is an ADDRESS, and the shape
 * behind it is optional (`facadeKeyOf` builds its key from a handler's name, which need not
 * be an entity's). The lie cost something real — `fougere sync` demanded a descriptor on
 * every entry and refused whole cards over a health check.
 */
export interface IdentityCard {
  fronds: Array<{
    name: string;
    doors: Array<{
      name: string;
      ops: CardOp[];
      /**
       * The shape stored under this name — **absent when nothing is**. A handler may
       * carry no entity (`bootstrap`: *pointing at nothing is legal*), and a door with
       * no rows behind it is ordinary: a health check, a computation, a search across
       * several shapes. A reader that needs the shape must say what it does without one.
       */
      schema?: SchemaDescriptor;
    }>;
    /**
     * The facts this frond ANNOUNCES — one entry per `Emit<T>` its handlers inject.
     *
     * They carry no operation, which is why they cannot ride in `doors`: the rule there is
     * *hosting means answering*, and an entity with no façade is excluded on purpose (it
     * would publish the auth tables to anyone who asks). A fact is the opposite case —
     * someone WROTE that it leaves, so publishing its shape is honouring a statement, not
     * leaking one.
     *
     * Without this, a fact stopped at the repository boundary: `remotes:` gives the
     * location, colocation gives the contract, and across two repositories there is no
     * colocation. The subscriber had to hand-copy the emitter's declaration.
     *
     * `schema` is absent when the announced type is not a declared entity — legal (nothing
     * requires a fact to be one) and worth saying rather than hiding: the name travels, the
     * shape does not, and a consumer can see exactly that.
     */
    facts: Array<{ name: string; schema?: SchemaDescriptor }>;
  }>;
}

/** A frond this process knows about, and whether it runs here. */
export interface FrondPlacement {
  frond: string;
  placement: 'local' | 'remote';
  entities: number;
  doors: number;
}

/** One frond calling another — an edge of the graph, counted where the call was made. */
export interface Edge {
  from: string;
  to: string;
  count: number;
  errors: number;
}

/**
 * The shape of the system as ONE process discovered it — the answer to `rpc.topology`.
 *
 * Here and not in the package that produces it, for the reason `SignedCall` is here: it
 * crosses a process boundary, so a reader consumes it without depending on the producer.
 * `@fougere/observability` fills it; a panel reads it; neither imports the other.
 *
 * Nothing in it is declared — a frond is `local` because this process scanned it, `remote`
 * because it answered a call nobody here hosts. `remotes:` states an intent, and the two
 * disagree exactly when something is misconfigured.
 */
export interface TopologyReport {
  /** When this process started counting — an edge count is read against it. */
  since: number;
  /** Calls running right now: the one signal a static shape cannot carry. */
  active: number;
  fronds: FrondPlacement[];
  edges: Edge[];
}

/**
 * The shape a card must have to be walked — `fronds`, and each frond's `doors`.
 *
 * A card crosses a process boundary, so it is judged like anything else that does.
 * The check lives beside the type because two readers walk it: the boot indexes a
 * remote's doors, and `fougere sync` writes classes from them. `TypeError:
 * card.fronds is not iterable` was what a malformed card produced at the boot,
 * naming neither the remote nor the address.
 *
 * The descriptor behind a door is NOT checked here — `Card.toSchema` refuses it, and
 * only where one is consumed.
 */
export function assertIdentityCard(value: unknown, source: string): IdentityCard {
  const card = value as IdentityCard | undefined;
  const fronds = Array.isArray(card?.fronds) ? card.fronds : undefined;
  if (!fronds) throw cardRefusal(source, 'no fronds array');
  for (const frond of fronds) {
    if (!frond || typeof frond.name !== 'string') throw cardRefusal(source, 'a frond with no name');
    if (!Array.isArray(frond.doors)) throw cardRefusal(source, `frond '${frond.name}' has no valid doors array`);
  }
  return card as IdentityCard;
}

function cardRefusal(source: string, what: string): FougereError {
  return new FougereError({
    code: ErrorCode.INTERNAL_ERROR,
    message:
      `${source} answered an invalid identity card: ${what}.\n`
      + `  A card is what tells this process what the other one hosts, so nothing can be routed from it.\n`
      + `  - Check that the address serves a Fougere app, and that its version still speaks this card.`,
  });
}

/** A façade as the runtime holds it: op names to functions, nothing typed about them. */
type AnyFacade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

/**
 * The door built in front of a handler — the framework's second port, after `EntityOrm`.
 *
 * `Facade<PostHandler>` is what a neighbouring frond injects. It names what ARRIVES
 * rather than what is written: never the handler (nobody injects it, and its methods take
 * positional arguments), but the door, whose every op takes the invocation and whose
 * implementation is the local façade or a doublure. A signature therefore says nothing
 * about where the other frond runs, which is the whole point.
 *
 * `keyof T` is the right set by construction, not by approximation: the scan skips
 * `private` and `protected` (`handler-parser.ts`) because "TypeScript already has the
 * word for it", so a handler's public methods ARE its operations — and `keyof` excludes
 * the rest for the same reason.
 */
export type Facade<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R
    ? (invocation?: InvocationContext) => R
    : never;
};

/**
 * The container key of a façade — THE one place that spells the format.
 *
 * A surface is a named audience, and it is a key: `handlers/public/PostHandler.ts`
 * registers `public:postHandler` next to the default `postHandler`. The default
 * surface is the empty key, so callers that know nothing about surfaces keep
 * designating exactly what they designated before.
 *
 * Nobody outside this package builds this string: adapters ask `app.facadeFor()`,
 * which is why an adapter can stay structurally typed and core-free.
 */
export function facadeKeyOf(entityName: string, surface?: string): string {
  return surface ? `${surface}:${entityName}Handler` : `${entityName}Handler`;
}

/**
 * Where the contracts behind a façade live — the dual of `facadeKeyOf`.
 *
 * The façade answers calls; it does not say what it answers. That sentence used
 * to be true only inside `buildFacade`, so anything asking the app what it hosts
 * got bare names. A door and its terms are registered together, under the same
 * audience.
 */
export function contractsKeyOf(entityName: string, surface?: string): string {
  return `${facadeKeyOf(entityName, surface)}:contracts`;
}

/**
 * Serialize what the app hosts, for one audience. Served on `rpc.discover`,
 * cached by callers.
 *
 * Hosting means answering: an entity with no façade declares no operation, so
 * it is not among the DOORS — publishing its shape would hand an anonymous caller
 * the structure of tables it can never reach (the auth tables, typically), and
 * `fougere sync` would rebuild a schema with nothing to call on it.
 *
 * `facts` is the one thing that shape-without-a-door rule does not cover, and the
 * reason is the opposite of a leak: an entity nobody exposed is silent, whereas a
 * fact was explicitly declared to leave.
 *
 * `surface` makes that sentence audience-aware rather than app-wide: a door
 * answers with what IT serves. Nothing falls back to the full façade — under a
 * named surface, an entity with no façade of its own is simply not there.
 */
export function identityCardOf(app: App, surface?: string): IdentityCard {
  const declared = app.fronds.schemas();

  return {
    fronds: app.fronds.map((frond) => {
      // What the frond answers to, not what it stores. This walked `frond.entities`, so a
      // handler carrying no entity — a health check, a search across shapes — was built,
      // served, and absent from the card: `sync` could not generate its door and a remote
      // consumer had no way to know it existed. The boot has said "pointing at nothing is
      // legal" since handlers became the subject; the card had not caught up.
      const byEntity = new Map(frond.entities.map((entity) => [entity.name, entity]));
      const addresses = [...new Set([
        ...frond.entities.map((entity) => entity.name),
        ...frond.handlers.map((handler) => handler.address),
      ])];

      return {
        name: frond.name,
        doors: addresses.flatMap((address) => {
          const ops = facadeOps(app, address, surface);
          if (ops.length === 0) return [];
          const entity = byEntity.get(address);
          return [{
            name: address,
            ops,
            // Absent when nothing of that name is stored. A door is still a door.
            ...(entity ? { schema: Card.fromSchema(entity.entityClass, address).descriptor } : {}),
          }];
        }),
        /**
         * What leaves on its own — the same list on every surface, deliberately.
         *
         * A door has an audience; a fact does not. `Emit<T>` names a subject and *the
         * number of readers is not the emitter's business* (`emit.ts`), so narrowing this
         * by `surface` would invent an axis the primitive refuses. The consequence is
         * stated rather than hidden: a fact's SHAPE is readable by anyone who can read the
         * card at all. What must not be published must not be announced.
         */
        facts: factsAnnouncedBy(frond.handlers).map((name) => {
          const entityClass = declared.get(name);
          return { name, ...(entityClass ? { schema: Card.fromSchema(entityClass, name).descriptor } : {}) };
        }),
      };
    }),
  };
}

function facadeOps(app: App, entityName: string, surface?: string): CardOp[] {
  let facade: AnyFacade;
  try {
    facade = app.container.resolve<AnyFacade>(facadeKeyOf(entityName, surface));
  } catch {
    return [];
  }

  // The façade is the list of names; the model is the resolved terms.
  const effective = app.operationsFor(entityName, surface);
  if (!effective) {
    throw new Error(
      `Facade '${facadeKeyOf(entityName, surface)}' exists without an effective operation table.`,
    );
  }

  return Object.keys(facade).map((name) => {
    const contract = effective.get(name);
    if (!contract) {
      throw new Error(
        `Facade '${facadeKeyOf(entityName, surface)}' serves '${name}' without an effective contract.`,
      );
    }

    return {
      name,
      ...(contract?.description && { description: contract.description }),
      ...(contract?.input && { input: Card.fromSchema(contract.input, name).descriptor }),
      ...(contract?.output && { output: Card.fromSchema(contract.output, name).descriptor }),
      ...(contract?.cardinality && { cardinality: contract.cardinality }),
      kind: contract.kind,
    };
  });
}

/**
 * Build the local runner — the reference realization of Transport.
 *
 * Resolves strictly from the app's own container: a call that lands here is
 * judged here. A miss is a typed NOT_FOUND, never a forward to another remote.
 */
export function createLocalRunner(app: App, surface?: string): Transport {
  return createTransportEntry(app.local, surface);
}

/**
 * Build the app runner — same judgment, but resolution follows the app's
 * topology: local façades and remote doublures alike. This is the runner
 * an app's own entry points (browser endpoint, bridges) stand on.
 *
 * `surface` is the audience this runner serves, and it belongs to the DOOR that
 * builds the runner, never to the call: a caller cannot name its own audience
 * any more than it can name its own identity (`state` is stamped server-side
 * for the same reason). Reaching the admin door IS the proof. So `FrondCall`
 * gains nothing and the wire format gains nothing — a remote frond's audience
 * is simply which URL `remotes:` points at.
 */
export function createAppRunner(app: App, surface?: string): Transport {
  return createTransportEntry(app, surface);
}
