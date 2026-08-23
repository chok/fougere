/**
 * The boot's two ends: what `createApp` takes, and what it hands back.
 *
 * The scan's descriptors moved to `frond.ts` and the auth contract to `auth.ts` — this
 * file was named after a role ("the types"), so everything with nowhere else to be
 * landed in it, seventeen notions deep.
 */
import type { Container } from '@fougere/container';
import type { Fronds } from '../scan/Fronds.js';
import type { ScanResult } from '../scan/frond.js';
import type { SchemaView } from '@fougere/schema';
import type { OrmFactory } from '../orm.js';
import type { AppMiddleware } from '../wire/middleware.js';
import type { RpcAnswer, Transport } from '../wire/call.js';
import type { Extension } from './Lifecycle.js';
import type { AuthConfig, AuthRuntime } from './auth.js';
import type { DispatchObserver } from '../dispatch/DispatchEvent.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';

/** Options for createApp(). */
export interface CreateAppOptions {
  /** Factory function to create the container. Required. */
  createContainer: () => Container;
  /** Factory to auto-generate EntityOrm for each scanned entity. */
  ormFactory?: OrmFactory;
  /**
   * Which source an entity's rows live in, and how to open a transaction on one — the two
   * questions that decide whether `Together<[…]>` gets the engine's own unwind or replays
   * inverses itself.
   *
   * Optional together, because a host may hand in a bare `ormFactory` and know neither. A
   * frame then compensates: not knowing where the rows are and promising atomicity over
   * them are two different things, and only one of them is honest.
   */
  sourceOf?: (entityName: string) => string;
  transacted?: <R>(source: string, fn: (ormFactory: OrmFactory) => Promise<R>) => Promise<R>;
  /**
   * Builds the cross-source reader a frond gets when it declares `reads:`.
   *
   * A factory rather than a value, for the same reason `ormFactory` is one: core must
   * not name a storage package, and this one costs 71 MB of downloaded extensions and a
   * native module — nothing a first run that only wanted sqlite should carry. The host
   * decides what backs it; `@fougere/adapter-duckdb` is one answer, not the contract.
   *
   * Called once per frond that asks, with the entity CLASSES its `reads:` named — a
   * name would make the reader resolve the schema a second time.
   */
  sourcesFactory?: (reads: unknown[], frond: string) => Promise<unknown> | unknown;
  /**
   * What this app is built from — required, because producing it is what reads a disk.
   *
   * `scanProject` (`@fougere/core/node`) reads the fronds off the filesystem; a module a
   * build wrote holds the same value with no disk at all. `createApp` cannot tell them
   * apart, and that is the point: it names no builtin, so a runtime without `node:fs`
   * runs it. `root` and `fronds` used to live here — both were arguments to the scan.
   */
  scan: ScanResult | (() => Promise<ScanResult> | ScanResult);
  /**
   * Remote fronds — label → address. What each remote hosts is discovered
   * at the first miss (rpc.discover), never declared here.
   */
  remotes?: Record<string, string>;
  /**
   * Builds the transport used to reach `remotes` addresses. Wired by
   * layer-2 packages (e.g. @fougere/transport-http); required when
   * `remotes` is non-empty.
   */
  remoteTransport?: (url: string) => Transport;
  /**
   * Which realization answers which port — see `FougereConfig.ports`. Needed only
   * when two classes extend the same port; one is resolved by convention.
   */
  ports?: Record<string, string>;
  /**
   * What this app takes on beyond its fronds, each stating what it does and what it undoes.
   *
   * `up` runs before `createApp` returns, in this order; `down` runs inside `dispose()`,
   * in reverse. Three levels release in reverse of construction, which is the container's
   * own rule read one level out: extensions first (built last), then the container, then
   * `onDispose` — a resource opened before any of this existed.
   *
   * A member may be `undefined`, so a host writes a conditional one inline rather than a
   * spread over a ternary. The framework's own two are always declared, `migrate` as an
   * empty slot when nothing migrates: a host filling it later REPLACES that member in
   * place instead of adding one after the seeds.
   */
  extensions?: ReadonlyArray<Extension | undefined>;
  /**
   * Released by `app.dispose()` AFTER the container, for a resource handed in rather
   * than built here — a storage connection is the one case today.
   *
   * NOT an extension, and the difference is a time: this was opened BEFORE the container,
   * so it closes after it, while an extension's `up` runs after the container and its
   * `down` therefore runs before. A storage's migration is an extension; its connection
   * is not, and `ResolvedStorage` declares the two beside each other.
   */
  onDispose?: () => Promise<void> | void;
  /**
   * Which protocol adapters this app serves — see `FougereConfig.adapters`.
   * Carried onto the App so every door reads one answer instead of each host
   * deciding for itself.
   */
  adapters?: Record<string, boolean | undefined>;
  /**
   * Carries an announced fact out of this process — a broker, a queue, a log.
   *
   * Called for every emission, ALONGSIDE the local dispatch and never instead of it: a
   * listener in this process is reached directly, and this is how the others hear.
   *
   * It exists because the local dispatch finds its listeners by having READ their code,
   * which stops at the repository boundary. A carrier hands the fact to a NAME; the far
   * side subscribes to that same name from its own code, and neither ever reads the other.
   *
   * Its failure never reaches the emitter — same rule as a subscriber's.
   */
  onEmit?: (fact: string, payload: unknown) => void | Promise<void>;
  /** Passive observers of every dispatch transition. */
  dispatchObservers?: readonly DispatchObserver[];
  /**
   * Storage handle to expose to the auth provider via AuthContext.db.
   * Required when `auth` is set.
   */
  db?: unknown;
  /** Auth declaration to wire into the app at boot. */
  auth?: AuthConfig;
}

/** The App object returned by createApp(). */
export interface App extends DispatchPort {
  /** Process-only dispatch capability used by incoming transports. */
  local: DispatchPort;
  /** Root container with builtins + frond scopes. */
  container: Container;
  /**
   * Which protocol adapters this app declared, from `fougere.config.ts`.
   *
   * Read by the doors themselves, so an undeclared adapter serves nothing whatever
   * the host mounted — the route file may exist, the middleware may be installed, and
   * the answer is still "not here".
   */
  adapters: Record<string, boolean | undefined>;
  /** Discovered fronds metadata. */
  fronds: Fronds;
  /** Resolve from root container (shortcut). */
  resolve<T>(name: string): T;
  /**
   * Resolve an entity's schema — the local `entityClass` when it's hosted or
   * scanned here, else reconstructed from the remote's identity card
   * (rpc.discover → reconstruct()). The one way to get a live schema for an
   * entity whose class may not be importable at all (another repo, another
   * language) — a card travelled, but until now its `schema` was thrown away.
   */
  schemaFor(entity: string): Promise<SchemaView>;
  /**
   * The door a name exposes to one audience, or `undefined` when it exposes
   * none. A named surface is CLOSED: a name with no door of its own under that
   * surface is not in it — it never falls back to the full one.
   *
   * **Not always a façade**, despite the name: when the owning frond is declared
   * remote, nothing is registered locally (`bootstrap.ts`, `declaredRemotes`) and
   * this resolves to a doublure — a façade-shaped stand-in (`remote.ts`). The
   * caller cannot tell, which is the point; the word here was simply wrong.
   *
   * The one way an adapter reaches that door. It exists so the key format stays
   * inside core (see `facadeKeyOf`), which is what lets a projection package
   * stay structurally typed and depend on nothing.
   */
  facadeFor(entity: string, surface?: string): Record<string, Function> | undefined;
  /**
   * The facts this app has a listener for — what a carrier must subscribe to on its behalf.
   *
   * Derived from the signatures it scanned (`Fact<T>` in an op's parameters), so a process
   * states what it listens to without anyone declaring it twice. The dual of `onEmit`: one
   * says what leaves, this says what should be brought in.
   */
  listensTo(): string[];
  /**
   * Hand a fact that came from OUTSIDE to the listeners in this process — and stop there.
   *
   * The dual of `onEmit`, and deliberately not the same thing as announcing: resolving the
   * emission value to deliver an inbound fact would carry it straight back out through
   * `onEmit`, so a hub echoed every reading it received to the whole fleet. Receiving and
   * announcing are two operations; only one of them leaves.
   *
   * The local dispatch is identical either way — same judge, same binding, same
   * middlewares — so a fact off a wire is no less checked than one raised next door.
   *
   * **It waits, and it tells** — the opposite of announcing, on purpose. It resolves once
   * every listener here is done, and REJECTS with an `AggregateError` if any refused. A
   * carrier's whole job is to know whether the fact landed: at-least-once is retrying what
   * failed, so a delivery that cannot report makes durability impossible to build above it.
   * "Dispatch is not delivery" protects the EMITTER from a slow subscriber; a carrier is
   * not the emitter, it is the party whose business this is.
   *
   * It still holds nothing. A refused fact is refused, and whether it comes back is the
   * carrier's decision — Fougere puts the channel underneath rather than reimplementing it.
   */
  deliver(fact: string, payload: unknown): Promise<void>;
  /**
   * The storage an entity is backed by, resolved through its owning frond's scope —
   * the dual of {@link facadeFor}. `undefined` when no loaded frond hosts the entity,
   * or when the app booted with no storage at all.
   *
   * `unknown` because the port belongs to whoever wired it: narrowing it to `EntityOrm`
   * is the caller saying which implementation they are standing on.
   */
  ormFor(entity: string): unknown | undefined;
  /**
   * The presenter of an entity, resolved through its owning frond's scope.
   *
   * Same shape as {@link ormFor}, and it exists so an adapter never spells the container
   * key itself: `schema-graphql` wrote out `${Name}Presenter` by hand, and a key respelled
   * in a second place finds nothing and reports nothing the day the convention moves.
   */
  presenterFor(entity: string): unknown | undefined;
  /** Dispose the root container. */
  dispose(): Promise<void>;
  /**
   * Stop taking calls, and resolve once the running ones are done.
   *
   * The step before releasing, when there is work on the app: `dispose()` closes a
   * storage connection the running calls are standing on. Rejects on `timeoutMs`
   * naming how many are left, rather than resolving as if it had succeeded.
   */
  drain(timeoutMs?: number): Promise<void>;
  /** How many calls are running right now — one count for all three doors and the wire. */
  inFlight(): number;
  /**
   * The same disposal, spelled so the language does it: `await using app = await
   * createApp(…)`. Twelve of the twenty-six mounts in this repo's own tests never
   * called `dispose()` — a scope that closes itself is the only version of that
   * rule nobody forgets.
   */
  [Symbol.asyncDispose](): Promise<void>;
  /**
   * What this app took on, in the order it will release them. The reading of
   * `CreateAppOptions.extensions` after the boot resolved it.
   */
  extensions(): string[];
  /**
   * Declare one `rpc` op — what the app says about ITSELF, beside the card.
   *
   * The gesture a package uses to add a reading core does not hold: an app that never
   * installed it never registers it, so the runner's refusal is the whole degradation.
   * A name already declared is refused rather than replaced — `discover` included.
   */
  serveRpc(op: string, answer: RpcAnswer): void;
  /** Register a global app middleware (runs on every operation). */
  use(middleware: AppMiddleware): void;
  /** Register an app middleware scoped to a specific entity. */
  use(entity: string, middleware: AppMiddleware): void;
  /** Auth runtime, present when fougere.config.ts declares `auth`. */
  auth?: AuthRuntime;
}
