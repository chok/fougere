/**
 * The contract of an operation, written the way the scan would derive it — for the fronds a test
 * states with `frond()` rather than scans. Core is tested on what it consumes; what the scan
 * produces is the compiler's to test.
 */
import type { OperationContract } from '../src/wire/OperationContract.js';
import type { BindingPlan } from '../src/wire/binding.js';

type Argument = BindingPlan[number];

const argument = (name: string, source: Argument['source'], optional = false): Argument => ({ name, source, optional });

/** A primitive read off the path or the query — `findById(id: string)`. */
export const param = (name: string, options: { coerce?: 'number' | 'boolean'; optional?: boolean } = {}): Argument =>
  argument(name, { kind: 'param', name, ...(options.coerce ? { coerce: options.coerce } : {}) }, options.optional);

/** The request input, judged against the contract's `input`. */
export const input = (name = 'input'): Argument => argument(name, { kind: 'input' });

/** What a collector answers for — `user?: User` is `collected('user', 'user', { optional: true })`. */
export const collected = (name: string, typeName: string, options: { optional?: boolean } = {}): Argument =>
  argument(name, { kind: 'collector', typeName }, options.optional);

/** A fact this operation subscribes to — `Fact<PostPublished>`. */
export const fact = (name: string, factName: string): Argument => argument(name, { kind: 'fact', factName });

/** A fact this operation finishes — `Pipe<PostPublished>`. */
export const pipe = (name: string, factName: string): Argument => argument(name, { kind: 'pipe', factName });

/** The invocation itself — `ctx: InvocationContext`. */
export const context = (name = 'ctx'): Argument => argument(name, { kind: 'context' });

/** One operation: what it takes, in order, and what the contract states beside it. */
export function op(contract: Omit<OperationContract, 'binding'> & { args?: Argument[] } = {}): OperationContract {
  const { args = [], ...rest } = contract;

  return { ...rest, binding: args };
}
