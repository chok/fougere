/** What a consumer writes, and nothing else. */
export { createApp } from './boot/bootstrap.js';
export { orderSeeds, runSeeds, seeding } from './boot/seed.js';
export { AppLifecycle, migrating } from './boot/AppLifecycle.js';
export type { Extension } from './boot/AppLifecycle.js';
export { defineFougere } from './define.js';
export type { FougereConfig, AdapterConfig } from './config-loader.js';
export type { OperationOverride, FrondConfig } from './frond-config.js';
export { buildGraph, clusterEntities, suggestSplit, type EntityNode, type DomainCluster } from './graph.js';
export { Crud } from './prefab/crud.js';
export type { CrudViews, CrudOps, CrudOpName, CrudConstructor } from './prefab/crud.js';
export { Mirror } from './prefab/mirror.js';
export type { Refreshed, MirrorOf, MirrorConstructor } from './prefab/mirror.js';
export { Presenter } from './prefab/presenter.js';
export type { PresenterViews } from './prefab/presenter.js';
export { Collector } from './prefab/collector.js';
export { Repository, type RepositoryOf, type RepositoryConstructor, type AggregateOf, type AggregateConstructor } from './prefab/repository.js';
export { Invocation } from './contract.js';
export type { InvocationContext } from './contract.js';
export { Call } from './contract.js';
export { RouteAddress } from './contract.js';
export { DispatchLifecycle } from './dispatch/DispatchLifecycle.js';
export { Dispatcher } from './dispatch/Dispatcher.js';
// The class and not only its type: an observer RECEIVES these, so a package that folds
// them — or a test of one — has to be able to make one through the door.
export { DispatchEvent } from './dispatch/DispatchEvent.js';
export type { CallPage, CallRecord } from './contract.js';
export { driftOf, agrees, explain, type CardDrift } from './contract.js';
export type {
  OperationContract,
  OperationsMap,
  Param,
  TypeRef,
} from './wire/operation.js';
export { resolveEffectiveOperations } from './effective-operation.js';
export type { EffectiveOperation } from './effective-operation.js';
export type { ModuleLoader } from './loader.js';
export { FougereError, ErrorCode, validationErrorsOf } from './contract.js';
export type { AppMiddleware, OperationContext, AppNext } from './wire/middleware.js';
export { assertIdentityCard, RPC_ENTITY, MAX_BODY_BYTES } from './contract.js';
export { createLocalRunner, createAppRunner } from './boot/runner.js';

// A frond an app STATES, for a boot that will not scan. No disk, no `typescript` — which
// is why it sits here and not in `/node`, beside the scanner that reads a project.
export { frond } from './declare.js';
export type { Declared, FrondDeclaration, DeclaredSubject } from './declare.js';
// What this app would answer to `rpc.discover`. Served by the boot, and reached until now
// only by tests through a deep path — a consumer comparing its own card to a producer's
// had to dispatch a call to ask a question about itself.
export { identityCardOf } from './boot/card.js';
export type { Facade } from './wire/call.js';
export type {
  FrondCall,
  Transport,
  IdentityCard,
  CardOp,
  TopologyReport,
  FrondPlacement,
  Edge,
} from './contract.js';
export { type Emit, type Fact } from './wire/emit.js';
export { callValueOf } from './contract.js';
export { toHttpError } from './wire/http-error.js';
export { toPublicError } from './contract.js';
export { loggerMiddleware } from './wire/loggerMiddleware.js';
export { Carry, Logger, setLogLevel, logLevel, envLevel, onLog, formatted } from './builtin/logger.js';
export type { LogRecord, Rendered, LogSink } from './builtin/logger.js';
// The fact a boot announces. Its destinations are `@fougere/log`'s; the line is core's.
export { default as LogLine, CARRIES_LINE, LOG_LINE } from './builtin/LogLine.js';
// What a re-read config changes in a running process — and what it cannot.
export { applyConfig } from './boot/apply.js';
export { Config } from './builtin/config.js';
export type { Storage, StorageFactory, ListOptions, ListResult, Together } from './storage/port.js';
export { togetherKeyOf } from './storage/port.js';
export type { Constraint, Source, SourceConfig, SourceView } from './source.js';
export { Sources } from './source.js';
export { storageOver } from './storage/store.js';
export type { Store, Values } from './storage/store.js';
export type { App, CreateAppOptions } from './boot/types.js';
export type { ScanResult, ScanDiagnostic } from './scan.js';
export {
  type Conventions, type ConventionsInput, DEFAULT_CONVENTIONS,
  resolveConventions, frondPackage, frondDirsOf, providerDirsOf,
} from './conventions.js';
export type {
  FrondDescriptor,
  FrondSource,
  ProviderEntry,
  EntityEntry,
  HandlerEntry,
  SeedEntry,
  PresenterEntry,
  PresenterFieldMeta,
  CollectorEntry,
} from './descriptor/frond.js';
export type { AuthConfig, AuthContext, AuthRuntime } from './boot/auth.js';
export { Fronds } from './descriptor/Fronds.js';
export { verify, type Violation } from './verify.js';
// Same question as verify(), answered from the source text instead of the model.
// Who is calling, established rather than accepted — the proof beside `state`'s claim.
// `generateKeyPair` and `issueGrant` are NOT here: they make keys at a deployment and
// need `node:crypto` for a gesture WebCrypto has no equal of. They sit on `/node`.
export { signEnvelope, verifyEnvelope, identityFromEnv } from './identity.js';
export type { FrondIdentity, SignedCall } from './identity.js';
