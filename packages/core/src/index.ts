/** What a consumer writes, and nothing else. */
export { createApp } from './boot/bootstrap.js';
export { orderSeeds, runSeeds, seeding } from './boot/seed.js';
export { AppLifecycle, AppLifecycle as Lifecycle, migrating } from './boot/AppLifecycle.js';
export type { Extension } from './boot/AppLifecycle.js';
export { defineFougere } from './define.js';
export type { AdapterConfig, FougereConfig } from './config-loader.js';
export type { FrondConfig, OperationOverride } from './frond-config.js';
export { buildGraph, clusterEntities, suggestSplit, type EntityNode, type DomainCluster } from './graph.js';
export { Crud } from './prefab/crud.js';
export type { CrudOps, CrudOpName, CrudViews, CrudConstructor } from './prefab/crud.js';
export { Mirror } from './prefab/mirror.js';
export type { MirrorOf, MirrorConstructor, Refreshed } from './prefab/mirror.js';
export { Presenter } from './prefab/presenter.js';
export type { PresenterViews } from './prefab/presenter.js';
export { Collector } from './prefab/collector.js';
export { Repository, type RepositoryOf, type RepositoryConstructor, type AggregateOf, type AggregateConstructor } from './prefab/repository.js';
export { Invocation, canonicalInvocation, EMPTY_INVOCATION } from './wire/Invocation.js';
export type { InvocationContext, InvocationInput } from './wire/Invocation.js';
export { Call } from './wire/call.js';
export { RouteAddress } from './wire/RouteAddress.js';
export type { RouteAddressInput } from './wire/RouteAddress.js';
export { DispatchLifecycle } from './dispatch/DispatchLifecycle.js';
export { Dispatcher } from './dispatch/Dispatcher.js';
// The class and not only its type: an observer RECEIVES these, so a package that folds
// them — or a test of one — has to be able to make one through the door.
export { DispatchEvent } from './dispatch/DispatchEvent.js';
export type { CallPage, CallRecord } from './wire/CallLog.js';
export { driftOf, agrees, explain, type CardDrift } from './wire/drift.js';
export type { DispatchObserver } from './dispatch/DispatchEvent.js';
export type { DispatchPort } from './dispatch/DispatchPort.js';
export {
  inferOperationKind,
  resolveIsReadOp,
  resolveOperationKind,
} from './wire/operation.js';
export { resolveContracts } from './effective-operation.js';
export type {
  OperationContract,
  OperationKind,
  OperationKindInference,
  OperationsMap,
  Param,
  TypeRef,
} from './wire/operation.js';
export {
  EFFECTIVE_OPERATION_SEMANTICS,
  EffectiveOperationModel,
  resolveEffectiveOperations,
} from './effective-operation.js';
export type {
  EffectiveCollector,
  EffectiveOperation,
  EffectiveOperationOptions,
  EffectiveOperationsMap,
  EffectiveParameter,
} from './effective-operation.js';
export type { ModuleLoader } from './loader.js';
export { FougereError, ErrorCode, validationErrorsOf, type FougereErrorOptions } from './wire/errors.js';
export type { OperationContext, AppNext, AppMiddleware } from './wire/middleware.js';
export { assertIdentityCard, RPC_ENTITY, MAX_BODY_BYTES } from './wire/call.js';
export { createLocalRunner, createAppRunner } from './boot/runner.js';

// A frond an app STATES, for a boot that will not scan. No disk, no `typescript` — which
// is why it sits here and not in `/node`, beside the scanner that reads a project.
export { frond } from './declare.js';
export type { FrondDeclaration, Declared, DeclaredSubject } from './declare.js';
// What this app would answer to `rpc.discover`. Served by the boot, and reached until now
// only by tests through a deep path — a consumer comparing its own card to a producer's
// had to dispatch a call to ask a question about itself.
export { identityCardOf } from './boot/card.js';
export type {
  FrondCall, Transport, IdentityCard, CardOp, Facade, RpcAnswer,
  TopologyReport, FrondPlacement, Edge,
} from './wire/call.js';
export { type Emit, type Fact } from './emit.js';
export { callValueOf } from './contract.js';
export type { CallValue } from './contract.js';
export { toHttpError, toPublicError } from './wire/http-error.js';
export { loggerMiddleware } from './wire/loggerMiddleware.js';
export { Logger, setLogLevel, logLevel, envLevel, onLog } from './builtin/logger.js';
export type { LogLevel, LogRecord, LogSink } from './builtin/logger.js';
// What a re-read config changes in a running process — and what it cannot.
export { applyConfig, type ConfigApplication } from './boot/apply.js';
export { Config } from './builtin/config.js';
export type { Storage, StorageFactory, ListOptions, ListResult, Together } from './storage.js';
export { togetherKeyOf, membersOfTogetherKey } from './storage.js';
export type { Source, SourceConfig, SourceView } from './source.js';
export { Sources } from './source.js';
export { storageOver } from './rows.js';
export type { Rows, Row } from './rows.js';
export type { App, CreateAppOptions } from './boot/types.js';
export type { ScanResult, ScanDiagnostic } from './scan/result.js';
export type {
  FrondDescriptor,
  FrondSource,
  ProviderEntry,
  EntityEntry,
  HandlerEntry,
  SeedEntry,
  SeedFactory,
  PresenterEntry,
  PresenterFieldMeta,
  CollectorEntry,
} from './descriptor/frond.js';
export type { AuthConfig, AuthContext, AuthRuntime } from './boot/auth.js';
export { Fronds } from './descriptor/Fronds.js';
export { verify, assertSplittable, type Violation } from './verify.js';
// Same question as verify(), answered from the source text instead of the model.
export type { CrossFrondImport } from './imports.js';
// Who is calling, established rather than accepted — the proof beside `state`'s claim.
// `generateKeyPair` and `issueGrant` are NOT here: they make keys at a deployment and
// need `node:crypto` for a gesture WebCrypto has no equal of. They sit on `/node`.
export { signEnvelope, verifyEnvelope, identityFromEnv } from './identity.js';
export type { FrondIdentity, VerifiedCall, CallIdentity, SignedCall } from './identity.js';
