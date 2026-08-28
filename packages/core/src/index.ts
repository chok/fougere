/**
 * What a consumer writes, and nothing else.
 *
 * `exports` publishes this barrel and `./contract`, so an import that is not here
 * cannot be reached from outside the package at all — which is what makes this file
 * the contract rather than a convenience. The machinery the boot uses to keep its own
 * promises stays inside: container keys, the binding plan, the mixin's runtime
 * accessors, the config merge. Measured on 2026-08-16, none of them had a single
 * importer anywhere in the workspace.
 */
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
export { Invocation, canonicalInvocation, EMPTY_INVOCATION } from './contract/Invocation.js';
export type { InvocationContext, InvocationInput } from './contract/Invocation.js';
export { Call } from './contract/Call.js';
export { RouteAddress } from './contract/RouteAddress.js';
export type { RouteAddressInput } from './contract/RouteAddress.js';
export { DispatchLifecycle } from './dispatch/DispatchLifecycle.js';
export { Dispatcher } from './dispatch/Dispatcher.js';
// The class and not only its type: an observer RECEIVES these, so a package that folds
// them — or a test of one — has to be able to make one through the door.
export { DispatchEvent } from './dispatch/DispatchEvent.js';
export type { CallPage, CallRecord } from './contract/CallLog.js';
export type { DispatchObserver } from './dispatch/DispatchEvent.js';
export type { DispatchPort } from './dispatch/DispatchPort.js';
export {
  inferOperationKind,
  resolveContracts,
  resolveIsReadOp,
  resolveOperationKind,
} from './wire/operation.js';
export type {
  OperationContract,
  OperationKind,
  OperationKindInference,
  OperationsMap,
  ParsedParam,
  ParsedType,
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
export { createLocalRunner, createAppRunner, assertIdentityCard, RPC_ENTITY } from './wire/call.js';
export type {
  FrondCall, Transport, IdentityCard, CardOp, Facade, RpcAnswer,
  TopologyReport, FrondPlacement, Edge,
} from './wire/call.js';
export { type Emit, type Fact } from './emit.js';
export { callValueOf } from './contract.js';
export type { CallValue } from './contract.js';
export { toHttpError, toPublicError } from './wire/http-error.js';
export { loggerMiddleware } from './wire/loggerMiddleware.js';
export { Logger, setLogLevel, logLevel, envLevel, onLog } from './builtins/logger.js';
export type { LogLevel, LogRecord, LogSink } from './builtins/logger.js';
// What a re-read config changes in a running process — and what it cannot.
export { applyConfig, type ConfigApplication } from './boot/apply.js';
export { Config } from './builtins/config.js';
export type { EntityOrm, OrmFactory, ListOptions, ListResult, Together } from './orm.js';
export { togetherKeyOf, membersOfTogetherKey } from './orm.js';
export type { App, CreateAppOptions } from './boot/types.js';
export type {
  ScanResult,
  ScanDiagnostic,
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
} from './scan/frond.js';
export type { AuthConfig, AuthContext, AuthRuntime } from './boot/auth.js';
export { Fronds } from './scan/Fronds.js';
export { verify, assertSplittable, type Violation } from './verify.js';
// Same question as verify(), answered from the source text instead of the model.
export type { CrossFrondImport } from './imports.js';
// Who is calling, established rather than accepted — the proof beside `state`'s claim.
// `generateKeyPair` and `issueGrant` are NOT here: they make keys at a deployment and
// need `node:crypto` for a gesture WebCrypto has no equal of. They sit on `/node`.
export { signEnvelope, verifyEnvelope, identityFromEnv } from './identity.js';
export type { FrondIdentity, VerifiedCall, CallIdentity, SignedCall } from './identity.js';
