/**
 * The contract of an operation, written the way the scan would derive it — for the fronds a test
 * states with `frond()` rather than scans. Core is tested on what it consumes; what the scan
 * produces is the compiler's to test.
 */
import type { OperationContract } from '../src/wire/OperationContract.js';
import type { BindingPlan } from '../src/wire/binding.js';
import type { Param } from '../src/wire/Param.js';

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

/**
 * A parameter by its TYPE — for a contract whose binding the boot must derive the way it does from
 * a scan, where what a check reads is the type name (`user?: User`, a collector of another frond).
 */
export const typed = (name: string, typeName: string, options: { optional?: boolean } = {}): Param =>
  ({ name, type: { raw: typeName, name: typeName }, ...(options.optional ? { optional: true } : {}) });

/**
 * One operation: what it takes, in order — as `args`, the binding itself, or as `params`, the
 * signature the boot derives one from — and what the contract states beside it.
 */
export function op(
  contract: Omit<OperationContract, 'binding' | 'signature'> & { args?: Argument[]; params?: Param[] } = {},
): OperationContract {
  const { args = [], params, ...rest } = contract;

  return params ? { ...rest, signature: { name: '', params } } : { ...rest, binding: args };
}
