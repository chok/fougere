/** What a consumer writes, and nothing else. */
export { createApp } from './boot/bootstrap.js';
export { orderSeeds, runSeeds, seeding } from './boot/seed.js';
export { AppLifecycle, migrating } from './boot/AppLifecycle.js';
export type { Extension } from './boot/Extension.js';
export { defineFougere } from './define.js';
export type { AdapterConfig } from './AdapterConfig.js';
export type { FougereConfig } from './FougereConfig.js';
export type { AnswerFor } from './AnswerFor.js';
export type { FougereNames } from './FougereNames.js';
export type { FougerePorts } from './FougerePorts.js';
export type { NameOf } from './NameOf.js';
export type { PortChoice } from './PortChoice.js';
export type { FrondConfig } from './FrondConfig.js';
export type { OperationOverride } from './OperationOverride.js';
export { buildGraph, clusterEntities, suggestSplit, type DomainCluster } from './DomainCluster.js';
export { type EntityNode } from './EntityNode.js';
export { Crud } from './prefab/CrudConstructor.js';
export type { CrudConstructor } from './prefab/CrudConstructor.js';
export type { CrudOpName } from './prefab/CrudOpName.js';
export type { CrudOps } from './prefab/CrudOps.js';
export type { CrudViews } from './prefab/CrudViews.js';
export { Mirror } from './prefab/MirrorConstructor.js';
export type { MirrorConstructor } from './prefab/MirrorConstructor.js';
export type { MirrorOf } from './prefab/MirrorOf.js';
export type { Refreshed } from './prefab/Refreshed.js';
export { Presenter } from './prefab/presenter.js';
export type { PresenterViews } from './prefab/presenter.js';
export { Collector } from './prefab/collector.js';
export { type AggregateConstructor } from './prefab/AggregateConstructor.js';
export { type AggregateOf } from './prefab/AggregateOf.js';
export { Repository, type RepositoryConstructor } from './prefab/RepositoryConstructor.js';
export { type RepositoryOf } from './prefab/RepositoryOf.js';
export { Invocation } from './contract.js';
export type { InvocationContext } from './contract.js';
export type { PartialInvocation } from './contract.js';
export { Call } from './contract.js';
export { RouteAddress } from './contract.js';
export { DispatchLifecycle } from './dispatch/DispatchLifecycle.js';
export { Dispatcher } from './dispatch/Dispatcher.js';
export { release, type Releasing } from './dispatch/Release.js';
export { releasing } from './boot/relations.js';
export { type Dependent } from './dispatch/Dependent.js';
export { JOURNAL, type Journal } from './dispatch/Journal.js';
// The class and not only its type: an observer RECEIVES these, so a package that folds
// them — or a test of one — has to be able to make one through the facade.
export { DispatchEvent } from './dispatch/DispatchEvent.js';
export type { CallPage, CallRecord } from './contract.js';
export { driftOf, agrees, explain, type CardDrift } from './contract.js';
export type { OperationContract } from './wire/OperationContract.js';
export type { OperationsMap } from './wire/OperationsMap.js';
export type { Param } from './wire/Param.js';
export type { TypeRef } from './wire/TypeRef.js';
export { resolveEffectiveOperations } from './EffectiveOperationModel.js';
export type { EffectiveOperation } from './EffectiveOperation.js';
export type { ModuleLoader } from './loader.js';
export { FougereError, ErrorCode, validationErrorsOf } from './contract.js';
export type { AppMiddleware } from './wire/AppMiddleware.js';
export type { AppNext } from './wire/AppNext.js';
export type { OperationContext } from './wire/OperationContext.js';
export { assertIdentityCard, RPC_ENTITY, MAX_BODY_BYTES } from './contract.js';
export { createLocalRunner, createAppRunner } from './boot/runner.js';

// A frond an app STATES, for a boot that will not scan. No disk, no `typescript` — which
// is why it sits here and not in `/node`, beside the scanner that reads a project.
export { frond } from './FrondDeclaration.js';
export type { Declared } from './Declared.js';
export type { DeclaredSubject } from './DeclaredSubject.js';
export type { FrondDeclaration } from './FrondDeclaration.js';
// What this app would answer to `rpc.discover`. Served by the boot, and reached until now
// only by tests through a deep path — a consumer comparing its own card to a producer's
// had to dispatch a call to ask a question about itself.
export { identityCardOf } from './boot/card.js';
// Its dual: what the app declares about its NEIGHBOURS. Read by `rpc.topology`, by
// `@fougere/calls` and by `fougere graph`, which each held their own half of it.
export { declaredTopologyOf } from './boot/declared.js';
// Both halves of what a call can refuse, put together where they are READ — the framework's
// follows from `kind` and `input`, so only the frond's travels.
export { refusalsOf, type Refusable } from './wire/refusals.js';
// The facades as TYPES — empty here, filled by the `.d.ts` the scan writes beside the app.
export type { Addresses } from './wire/Addresses.js';
export type { Answer } from './wire/Answer.js';
export type { AnyHandler } from './wire/AnyHandler.js';
export type { FacadeName } from './wire/FacadeName.js';
export type { FougereHandlers } from './wire/FougereHandlers.js';
export type { FougereOperations } from './wire/FougereOperations.js';
export type { HandlerOf } from './wire/HandlerOf.js';
export type { Refused } from './wire/Refused.js';
export type { Rows } from './wire/Rows.js';
export type { Facade } from './wire/Facade.js';
export type {
  FrondCall,
  Transport,
  IdentityCard,
  CardOp,
  TopologyReport,
  FrondPlacement,
  Edge,
  DeclaredTopology,
  DeclaredFrond,
  DeclaredEdge,
} from './contract.js';
export { type Emit } from './wire/Emit.js';
export { type Fact } from './wire/Fact.js';
export { type Pipe } from './wire/Pipe.js';
export { callValueOf } from './contract.js';
export { toHttpError } from './wire/http-error.js';
export { toPublicError } from './contract.js';
export { loggerMiddleware } from './wire/loggerMiddleware.js';
export { Carry } from './builtin/Carry.js';
export { Logger, envLevel, formatted, logLevel, setLogLevel } from './builtin/Logger.js';
export type { LogRecord } from './builtin/LogRecord.js';
export type { LogSink } from './builtin/LogSink.js';
export type { Rendered } from './builtin/Rendered.js';
// The fact a boot announces. Its destinations are `@fougere/log`'s; the line is core's.
export { default as LogLine, CARRIES_LINE, LOG_LINE } from './builtin/LogLine.js';
// What a re-read config changes in a running process — and what it cannot.
export { applyConfig } from './boot/apply.js';
export { Config } from './builtin/config.js';
export type { ListOptions } from './storage/ListOptions.js';
export type { ListResult } from './storage/ListResult.js';
export type { StorageFactory } from './storage/StorageFactory.js';
export type { Together } from './storage/Together.js';
// A VALUE as well as a type: it is what a wrapper extends, which is the whole of declaring one.
export { Storage, togetherKeyOf } from './storage/Storage.js';
export type { Constraint } from './Constraint.js';
export type { Source } from './Source.js';
export type { SourceConfig } from './SourceConfig.js';
export type { SourceView } from './SourceView.js';
export { Sources } from './Source.js';
export { storageOver } from './storage/Store.js';
export type { Store } from './storage/Store.js';
export type { Values } from './storage/Values.js';
export type { App } from './boot/App.js';
export type { CreateAppOptions } from './boot/CreateAppOptions.js';
export type { ScanResult } from './scan.js';
export type { Diagnostic } from './diagnostic.js';
export { DEFAULT_CONVENTIONS, frondDirsOf, frondPackage, providerDirsOf, resolveConventions, type Conventions } from './Conventions.js';
export { type ConventionsInput } from './ConventionsInput.js';
export type { CollectorEntry } from './descriptor/CollectorEntry.js';
export type { EntityEntry } from './descriptor/EntityEntry.js';
export type { FrondDescriptor } from './descriptor/FrondDescriptor.js';
export type { FrondSource } from './descriptor/FrondSource.js';
export type { HandlerEntry } from './descriptor/HandlerEntry.js';
export type { PresenterEntry } from './descriptor/PresenterEntry.js';
export type { PresenterFieldMeta } from './descriptor/PresenterFieldMeta.js';
export type { ProviderEntry } from './descriptor/ProviderEntry.js';
export type { SeedEntry } from './descriptor/SeedEntry.js';
export type { AuthConfig } from './boot/AuthConfig.js';
export type { AuthContext } from './boot/AuthContext.js';
export type { AuthRuntime } from './boot/AuthRuntime.js';
export { Fronds } from './descriptor/Fronds.js';
export { verify, type Misplaced } from './verify.js';
// Same question as verify(), answered from the source text instead of the model.
// Who is calling, established rather than accepted — the proof beside `state`'s claim.
// `generateKeyPair` and `issueGrant` are NOT here: they make keys at a deployment and
// need `node:crypto` for a gesture WebCrypto has no equal of. They sit on `/node`.
export { signEnvelope, verifyEnvelope, identityFromEnv } from './CallIdentity.js';
export type { FrondIdentity } from './FrondIdentity.js';
export type { SignedCall } from './wire/SignedCall.js';
