/** The boot's two ends. */
import type { Container } from '@fougere/container';
import type { Fronds } from '../descriptor/Fronds.js';
import type { FrondDescriptor } from '../descriptor/frond.js';
import type { ScanResult } from '../scan/result.js';
import type { SchemaView } from '@fougere/schema';
import type { StorageFactory } from '../storage.js';
import type { AppMiddleware } from '../wire/middleware.js';
import type { RpcAnswer, Transport } from '../wire/call.js';
import type { Extension } from './AppLifecycle.js';
import type { AuthConfig, AuthRuntime } from './auth.js';
import type { EffectiveOperationsMap } from '../effective-operation.js';
import type { DispatchObserver } from '../dispatch/DispatchEvent.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';

/** Options for createApp(). */
export interface CreateAppOptions {
  /** Factory function to create the container. Required. */
  createContainer: () => Container;
  /** Factory to auto-generate Storage for each scanned entity. */
  storageFactory?: StorageFactory;
  /**
   * Which source an entity's rows live in, and how to open a transaction on one — the two
   * questions that decide whether `Together<[…]>` gets the engine's own unwind or replays inverses
   * itself.
   */
  sourceOf?: (entityName: string) => string;
  transacts?: (source: string) => boolean;
  transacted?: <R>(source: string, fn: (storageFactory: StorageFactory) => Promise<R>) => Promise<R>;
  /** Builds the cross-source reader a frond gets when it declares `reads:`. */
  sourcesFactory?: (reads: unknown[], frond: string) => Promise<unknown> | unknown;
  /** What this app is built from — required, because producing it is what reads a disk. */
  scan?: ScanResult | (() => Promise<ScanResult> | ScanResult);
  /** What this app STATES it hosts — `frond('blog', { entities: [Post] })`. */
  fronds?: readonly FrondDescriptor[];
  /**
   * Remote fronds — label → address. What each remote hosts is discovered
   * at the first miss (rpc.discover), never declared here.
   */
  remotes?: Record<string, string>;
  /** Builds the transport used to reach `remotes` addresses. */
  remoteTransport?: (url: string) => Transport;
  /**
   * Which realization answers which port — see `FougereConfig.ports`. Needed only
   * when two classes extend the same port; one is resolved by convention.
   */
  ports?: Record<string, string>;
  /** What this app takes on beyond its fronds, each stating what it does and what it undoes. */
  extensions?: readonly (Extension | undefined)[];
  /**
   * Released by `app.dispose()` AFTER the container, for a resource handed in rather than built
   * here — a storage connection is the one case today.
   */
  onDispose?: () => Promise<void> | void;
  /** Which protocol adapters this app serves — see `FougereConfig.adapters`. */
  adapters?: Record<string, boolean | undefined>;
  /** Carries an announced fact out of this process — a broker, a queue, a log. */
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
  /** Which protocol adapters this app declared, from `fougere.config.ts`. */
  adapters: Record<string, boolean | undefined>;
  /** Where a call goes, as the config declared it — frond name to address. */
  remotes: Readonly<Record<string, string>>;
  /** Discovered fronds metadata. */
  fronds: Fronds;
  /** Resolve from root container (shortcut). */
  resolve<T>(name: string): T;
  /**
   * Resolve an entity's schema — the local `entityClass` when it's hosted or scanned here, else
   * reconstructed from the remote's identity card (`rpc.discover` to `Card.toSchema`).
   */
  schemaFor(entity: string): Promise<SchemaView>;
  /** The door a name exposes to one audience, or `undefined` when it exposes none. */
  facadeFor(entity: string, surface?: string): Record<string, Function> | undefined;
  /**
   * The canonical contracts served beside a facade, after prefab + scan + config, binding, kind,
   * topology and surface resolution.
   */
  operationsFor(entity: string, surface?: string): EffectiveOperationsMap | undefined;
  /** The facts this app has a listener for — what a carrier must subscribe to on its behalf. */
  listensTo(): string[];
  /** Hand a fact that came from OUTSIDE to the listeners in this process — and stop there. */
  deliver(fact: string, payload: unknown): Promise<void>;
  /**
   * The storage an entity is backed by, resolved through its owning frond's scope — the dual of
   * {@link facadeFor}.
   */
  storageFor(entity: string): unknown | undefined;
  /** The presenter of an entity, resolved through its owning frond's scope. */
  presenterFor(entity: string): unknown | undefined;
  /** Dispose the root container. */
  dispose(): Promise<void>;
  /** Stop taking calls, and resolve once the running ones are done. */
  drain(timeoutMs?: number): Promise<void>;
  /** How many calls are running right now — one count for all three doors and the wire. */
  inFlight(): number;
  /** The same disposal, spelled so the language does it: `await using app = await createApp(…)`. */
  [Symbol.asyncDispose](): Promise<void>;
  /**
   * What this app took on, in the order it will release them. The reading of
   * `CreateAppOptions.extensions` after the boot resolved it.
   */
  extensions(): string[];
  /** Declare one `rpc` op — what the app says about ITSELF, beside the card. */
  serveRpc(operationName: string, answer: RpcAnswer): void;
  /** Register a global app middleware (runs on every operation). */
  /** Watch every dispatch transition; the returned function unsubscribes. */
  observe(observer: DispatchObserver): () => void;
  use(middleware: AppMiddleware): void;
  /** Register an app middleware scoped to a specific entity. */
  use(entity: string, middleware: AppMiddleware): void;
  /** Auth runtime, present when fougere.config.ts declares `auth`. */
  auth?: AuthRuntime;
}
