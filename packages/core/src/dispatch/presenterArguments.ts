import { computeBindingPlan } from '../wire/binding.js';
import type { InvocationContext } from '../wire/Invocation.js';
import type { PresenterEntry } from '../descriptor/frond.js';
import type { ArgumentResolver } from './ArgumentResolver.js';
import type { PresenterArgs } from './PresenterExecutor.js';

/** The invocation-dependent arguments of every computed presenter field. */
export async function presenterArguments(
  meta: PresenterEntry,
  invocation: InvocationContext,
  resolver: ArgumentResolver,
  collectorTypes: Set<string>,
): Promise<PresenterArgs> {
  const argumentsByField: PresenterArgs = {};

  for (const field of meta.fieldMeta) {
    if (!field.params?.length) continue;
    argumentsByField[field.name] = await resolver.resolve(
      computeBindingPlan(field.params, collectorTypes),
      invocation,
    );
  }

  return argumentsByField;
}
