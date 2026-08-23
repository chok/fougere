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
export { Lifecycle, migrating } from './boot/Lifecycle.js';
export type { Extension } from './boot/Lifecycle.js';
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
export type { InvocationContext } from './wire/invocation.js';
export { EMPTY_INVOCATION } from './wire/invocation.js';
export { resolveIsReadOp, resolveContracts } from './wire/operation.js';
export type { OperationContract, OperationsMap } from './wire/operation.js';
export type { ModuleLoader } from './loader.js';
export { FougereError, ErrorCode, validationErrorsOf, type FougereErrorOptions } from './wire/errors.js';
export type { OperationContext, AppNext, AppMiddleware } from './wire/middleware.js';
export { createLocalRunner, createAppRunner, assertIdentityCard } from './wire/call.js';
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
