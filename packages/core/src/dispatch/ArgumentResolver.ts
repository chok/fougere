import {
  resolveArgs,
  type BindingPlan,
  type CollectorResolver,
} from '../boot/binding.js';
import type { InvocationContext } from '../contract/Invocation.js';

export type CollectorLookup = (typeName: string) => CollectorResolver | undefined;

/** Resolves an operation's declared binding plan against one invocation. */
export class ArgumentResolver {
  constructor(private readonly collectors?: CollectorLookup) {}

  resolve(plan: BindingPlan, invocation: InvocationContext): Promise<unknown[]> {
    return resolveArgs(plan, invocation, this.collectors);
  }
}
