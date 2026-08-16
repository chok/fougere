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
export { createApp } from './bootstrap.js';
export { boot } from './boot.js';
export { orderSeeds, runSeeds } from './seed.js';
export { defineFougere } from './define.js';
export { loadConfig, loadCascadedConfig, type AdapterConfig, type FougereConfig } from './config-loader.js';
export { defineFrond, type FrondConfig, type OperationOverride } from './frond-config.js';
export { buildGraph, clusterEntities, suggestSplit, type EntityNode, type DomainCluster } from './graph.js';
export { Crud } from './crud.js';
export type { CrudOps, CrudOpName, CrudViews, CrudConstructor } from './crud.js';
export { Mirror } from './mirror.js';
export type { MirrorOf, MirrorConstructor, Refreshed } from './mirror.js';
export { Presenter } from './presenter.js';
export type { PresenterViews } from './presenter.js';
export { Collector } from './collector.js';
export { Repository, type RepositoryOf, type RepositoryConstructor } from './repository.js';
export type { InvocationContext } from './invocation.js';
export { EMPTY_INVOCATION } from './invocation.js';
export { resolveIsReadOp, resolveContracts } from './operation.js';
export type { OperationContract, OperationsMap } from './operation.js';
export { scanProject, frondAliases, FROND_DIRS, setModuleLoader, type ModuleLoader } from './scanner.js';
export { FougereError, ErrorCode, type FougereErrorOptions } from './errors.js';
export type { OperationContext, AppNext, AppMiddleware } from './middleware.js';
export { createLocalRunner, createAppRunner } from './call.js';
export type { FrondCall, Transport, IdentityCard, CardOp, Facade } from './call.js';
export { type Emit, type Fact } from './emit.js';
export { callValueOf } from './contract.js';
export type { CallValue } from './contract.js';
export { toHttpError, toPublicError } from './http-error.js';
export { loggerMiddleware } from './middleware/logger.js';
export { errorMiddleware } from './middleware/error-handler.js';
export { Logger } from './builtins/logger.js';
export { Config } from './builtins/config.js';
export type { EntityOrm, OrmFactory, ListOptions, ListResult } from './orm.js';
export type { App, CreateAppOptions } from './types.js';
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
} from './frond.js';
export type { AuthConfig, AuthContext, AuthRuntime } from './auth.js';
export { Fronds } from './Fronds.js';
export { verify, assertSplittable, type Violation } from './verify.js';
// Same question as verify(), answered from the source text instead of the model.
export { crossFrondImports, type CrossFrondImport } from './imports.js';
