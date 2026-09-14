import type { Container } from '@fougere/container';
import type { Fronds } from '../descriptor/Fronds.js';
import type { SchemaView } from '@fougere/schema';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import type { RpcAnswer } from '../wire/RpcAnswer.js';
import type { AuthRuntime } from './AuthRuntime.js';
import type { EffectiveOperationsMap } from '../EffectiveOperationsMap.js';
import type { DispatchObserver } from '../dispatch/DispatchObserver.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';

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
  /** The facade a name exposes to one audience, or `undefined` when it exposes none. */
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
  /** How many calls are running right now — one count for all three facades and the wire. */
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
  /** Watch every dispatch transition; the returned function unsubscribes. */
  observe(observer: DispatchObserver): () => void;
  /** Register a global app middleware (runs on every operation). */
  use(middleware: AppMiddleware): void;
  /** Register an app middleware scoped to a specific entity. */
  use(entity: string, middleware: AppMiddleware): void;
  /** Auth runtime, present when fougere.config.ts declares `auth`. */
  auth?: AuthRuntime;
}
