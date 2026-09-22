import { lowerFirst } from '@fougere/schema';
import { computeBindingPlan } from './binding.js';
import type { OperationContract } from './OperationContract.js';
import type { OperationsMap } from './OperationsMap.js';

/**
 * What an emitter injects. PARTIAL, because announcing is what REALIZES the fact's
 * `lifecycle.create` — an `at: created()` is stamped by `Emissions`, so requiring it from
 * the announcer made every emitter cast its way past its own type. A missing field is
 * still refused, by the judge that reads the fact at announce time.
 */
export type Emit<T, A = never> = (fact: Partial<T>) => Promise<A[]>;

/** The container key of an emission — THE one place that spells the format. */
export function emitKeyOf(fact: string): string {
  return `${lowerFirst(fact)}Emit`;
}

/**
 * The key of an emission that WAITS — `Emit<CanBook, Verdict>`, where the second type is
 * the whole difference. A separate key because they are two functions: one hands the fact
 * over and returns, the other waits for every subscriber and gives back what they said.
 */
export function awaitKeyOf(fact: string): string {
  return `${lowerFirst(fact)}Await`;
}

const SUFFIX = 'Emit';

const AWAIT_SUFFIX = 'Await';

/** The fact behind an emission key, or `undefined` when the key is not one. */
export function factOfEmitKey(key: string): string | undefined {
  return behind(key, SUFFIX);
}

/** The fact behind an awaited emission's key — the dual, read the same way. */
function factOfAwaitKey(key: string): string | undefined {
  return behind(key, AWAIT_SUFFIX);
}

function behind(key: string, suffix: string): string | undefined {
  return key.length > suffix.length && key.endsWith(suffix)
    ? key.slice(0, -suffix.length)
    : undefined;
}

/** What a set of handlers ANNOUNCES — `Emit<T>` read back out of their dependencies. */
export function factsAnnouncedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return factsIn(handlers, factOfEmitKey);
}

/** What a set of handlers announces AND WAITS FOR — the same reading, one suffix apart. */
export function factsAwaitedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return factsIn(handlers, factOfAwaitKey);
}

/**
 * What a set of handlers LISTENS to — the dual of what it announces, and the half no
 * dependency spells: accepting a `Fact<T>` IS the subscription, so it is read from the
 * binding plan, where `Emissions` reads it too.
 */
export function factsListenedTo(handlers: readonly { operations: OperationsMap }[]): string[] {
  const taken = (contract: OperationContract): string[] => {
    const plan = contract.binding
      ?? (contract.signature ? computeBindingPlan(contract.signature.params, NO_COLLECTOR) : []);

    return plan.flatMap((bound) =>
      bound.source.kind === 'fact' || bound.source.kind === 'pipe' ? [bound.source.factName] : []);
  };

  return [...new Set(handlers.flatMap((handler) => [...handler.operations.values()].flatMap(taken)))];
}

/** `Fact` and `Pipe` name themselves, and the plan reads them before it reads a collector. */
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
