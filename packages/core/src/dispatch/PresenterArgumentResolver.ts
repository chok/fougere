import { computeBindingPlan } from '../wire/binding.js';
import type { InvocationContext } from '../contract/Invocation.js';
import type { PresenterEntry } from '../descriptor/frond.js';
import type { ArgumentResolver } from './ArgumentResolver.js';
import type { PresenterArgs } from './PresenterExecutor.js';

/** Resolves the invocation-dependent arguments of every computed presenter field. */
export class PresenterArgumentResolver {
  constructor(
    private readonly argumentsResolver: ArgumentResolver,
    private readonly collectorTypes: Set<string>,
  ) {}

  async resolve(meta: PresenterEntry, invocation: InvocationContext): Promise<PresenterArgs> {
    const argumentsByField: PresenterArgs = {};
    for (const field of meta.fieldMeta) {
      if (!field.params?.length) continue;
      argumentsByField[field.name] = await this.argumentsResolver.resolve(
        computeBindingPlan(field.params, this.collectorTypes),
        invocation,
      );
    }
    return argumentsByField;
  }
}
