/**
 * What it takes to PRODUCE a descriptor — the surface a scan reads, whoever wrote it.
 * The main entry serves what an app RUNS; this one serves what fills it in.
 */
export * from './frond.js';
export { Fronds } from './Fronds.js';

export { cardinalityOf, type OperationContract, type OperationsMap, type Param, type TypeRef } from '../wire/operation.js';
export { computeBindingPlan, type BindingPlan } from '../wire/binding.js';
export type { Signature } from '../wire/signature.js';
export { emitKeyOf, askKeyOf } from '../wire/emit.js';
export { storageKeyOf } from '../storage/port.js';
export { getPresenterFields } from '../prefab/presenter.js';
export { targetOf, viewsOf, outputOf } from '../prefab/prefab.js';
export { ownedBy, repositoryKeyOf } from '../prefab/repository.js';
