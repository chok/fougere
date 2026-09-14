/**
 * What it takes to PRODUCE a descriptor — the surface a scan reads, whoever wrote it.
 * The main entry serves what an app RUNS; this one serves what fills it in.
 */
export * from './ProviderEntry.js';
export * from './EntityEntry.js';
export * from './HandlerEntry.js';
export * from './PresenterFieldMeta.js';
export * from './PresenterEntry.js';
export * from './CollectorEntry.js';
export * from './MiddlewareEntry.js';
export * from './SeedEntry.js';
export * from './SeedFactory.js';
export * from './FrondSource.js';
export * from './ExtensionEntry.js';
export * from './FrondDescriptor.js';
export { Fronds } from './Fronds.js';

export { cardinalityOf, type OperationContract } from '../wire/OperationContract.js';
export { type OperationsMap } from '../wire/OperationsMap.js';
export { type Param } from '../wire/Param.js';
export { type TypeRef } from '../wire/TypeRef.js';
export { computeBindingPlan, type BindingPlan } from '../wire/binding.js';
export type { Signature } from '../wire/Signature.js';
export { awaitKeyOf, emitKeyOf } from '../wire/Emit.js';
export { storageKeyOf } from '../storage/Storage.js';
export { getPresenterFields } from '../prefab/presenter.js';
export { targetOf, viewsOf, outputOf } from '../prefab/prefab.js';
export { ownedBy, repositoryKeyOf } from '../prefab/RepositoryConstructor.js';

// The surfaces a handler answers on — a directory names one, and so does `frond.config.ts`.
export { servedSurfaces } from './surface.js';
export { basesOf } from './bases.js';
