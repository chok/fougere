import { lowerFirst, upperFirst } from '@fougere/schema';
import { subjectKeyOf, subjectsOf } from './SubjectKey.js';
import { computeBindingPlan } from '../bindingPlan.js';
import type { OperationContract } from './OperationContract.js';
import type { OperationsMap } from './OperationsMap.js';

/** What an emitter injects; partial, because announcing fills the fact's `created()` fields. */
export type Emit<T, A = never> = (fact: Partial<T>) => Promise<A[]>;

/** The container key of an emission — `Emit<PostPublished>`, spelled as the type is written. */
export function emitKeyOf(fact: string): string {
  return subjectKeyOf('Emit', upperFirst(fact));
}

/**
 * The key of an emission that waits for its answers.
 * Ex: `Emit<CanBook, Verdict>`.
 */
export function awaitKeyOf(fact: string, answer: string): string {
  return subjectKeyOf('Emit', upperFirst(fact), upperFirst(answer));
}

/** The fact behind an emission key, or `undefined` when the key is not one. */
export function factOfEmitKey(key: string): string | undefined {
  const subjects = subjectsOf(key, 'Emit');

  return subjects?.length === 1 ? lowerFirst(subjects[0]!) : undefined;
}

/** The fact behind an awaited emission's key — two subjects, the second what each subscriber answers. */
export function factOfAwaitKey(key: string): string | undefined {
  const subjects = subjectsOf(key, 'Emit');

  return subjects?.length === 2 ? lowerFirst(subjects[0]!) : undefined;
}

/** The keys a set of handlers asks to announce and wait under — `Emit<CanBook, Verdict>`, each as written. */
export function awaitKeysIn(handlers: readonly { deps: readonly string[] }[]): string[] {
  return [...new Set(handlers.flatMap((handler) => handler.deps.filter((dep) => factOfAwaitKey(dep) !== undefined)))];
}

/** What a set of handlers ANNOUNCES — `Emit<T>` read back out of their dependencies. */
export function factsAnnouncedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return factsIn(handlers, factOfEmitKey);
}

/** What a set of handlers announces AND WAITS FOR — the same reading, one suffix apart. */
export function factsAwaitedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return factsIn(handlers, factOfAwaitKey);
}

/** What a set of handlers listens to, read off their binding plans. */
export function factsListenedTo(handlers: readonly { operations: OperationsMap }[]): string[] {
  const taken = (contract: OperationContract): string[] => {
    const plan = contract.binding
      ?? (contract.signature ? computeBindingPlan(contract.signature.params, NO_COLLECTOR) : []);

    return plan.flatMap((bound) =>
      bound.source.kind === 'fact' || bound.source.kind === 'pipe' ? [bound.source.factName] : []);
  };

  return [...new Set(handlers.flatMap((handler) => [...handler.operations.values()].flatMap(taken)))];
}

/** Whether an op is called by an announcement, through a `Fact<T>` or a `Pipe<T>`. */
export function listens(op: { binding?: readonly { source: { kind: string } }[] }): boolean {
  return (op.binding ?? []).some(({ source }) => source.kind === 'fact' || source.kind === 'pipe');
}

const NO_COLLECTOR = new Set<string>();

function factsIn(
  handlers: readonly { deps: readonly string[] }[],
  behindKey: (key: string) => string | undefined,
): string[] {
  return [...new Set(
    handlers
      .flatMap((handler) => handler.deps)
      .map(behindKey)
      .filter((fact): fact is string => fact !== undefined),
  )];
}
