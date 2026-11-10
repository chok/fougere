import type { Plugged } from '../wire/Plugged.js';
import type { Container } from '@fougere/container';
import type { Fronds } from '../descriptor/Fronds.js';
import type { SchemaView } from '@fougere/schema';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import type { RpcAnswer } from '../wire/RpcAnswer.js';
import type { EffectiveOperationsMap } from '../operation/EffectiveOperationsMap.js';
import type { Answering } from '../entry/door.js';
import type { DispatchObserver } from '../dispatch/DispatchObserver.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';
import type { Storage } from '../storage/Storage.js';
import type { ProtocolConfig } from '../extension/Protocol.js';

/** The App object returned by createApp(). */
export interface App extends DispatchPort {
  /** Process-only dispatch capability used by incoming transports. */
  local: DispatchPort;
  /** Root container with builtins + frond scopes. */
  container: Container;
  /** The protocols this app serves, from `fougere.config.ts`. */
  protocols: ProtocolConfig;
  /** Where a call goes, as the config declared it — frond name to address. */
  remotes: Readonly<Record<string, string>>;
  /** Discovered fronds metadata. */
  fronds: Fronds;
  /** Resolve from root container (shortcut). */
  resolve<T>(name: string): T;
  /** An entity's schema: its class when hosted here, else rebuilt from the remote's card. */
  schemaFor(entity: string): Promise<SchemaView>;
  /** The facade a name exposes to one audience, or `undefined` when it exposes none. */
  facadeFor(address: string, surface?: string): Record<string, Function> | undefined;
  /** The resolved contracts served beside a facade. */
  operationsFor(address: string, surface?: string): EffectiveOperationsMap | undefined;
  /** The facts this app has a listener for — what a carrier must subscribe to on its behalf. */
  listensTo(): string[];
  /** Whether an announcement calls this op. */
  listens(address: string, op: string): Promise<boolean>;
  /** Hand a fact that came from OUTSIDE to the listeners in this process — and stop there. */
  deliver(fact: string, payload: unknown): Promise<void>;
  /** The storage an entity is backed by, through its owning frond's scope. */
  storageFor<T = Record<string, unknown>>(entity: string): Storage<T> | undefined;
  /** The presenter of an entity, resolved through its owning frond's scope. */
  presenterFor(entity: string): unknown | undefined;
  /** What answers each extension point in this app — registries by name, ports, seams, middlewares and steps by type. */
  extensionPoints(): readonly Plugged[];
  /** Dispose the root container. */
  dispose(): Promise<void>;
  /** Stop taking calls, and resolve once the running ones are done. */
  drain(timeoutMs?: number): Promise<void>;
  /** How many calls are running right now — one count for all three facades and the wire. */
  inFlight(): number;
  /** The same disposal, spelled so the language does it: `await using app = await createApp(…)`. */
  [Symbol.asyncDispose](): Promise<void>;
  /** The extensions this app took on, in the order it will release them. */
  extensions(): string[];
  /** Declare one `rpc` op — what the app says about ITSELF, beside the card. */
  serveRpc(operationName: string, answer: RpcAnswer): void;
  /** Watch every dispatch transition, and every request at a door; the returned function unsubscribes. */
  observe(observer: DispatchObserver): () => void;
  /** Run one request through a door — the cycle every way in shares, whichever package brought it. */
  answer: Answering;
  /** Register a global app middleware (runs on every operation). */
  use(middleware: AppMiddleware): void;
  /** Register an app middleware scoped to one address. */
  use(address: string, middleware: AppMiddleware): void;
}
