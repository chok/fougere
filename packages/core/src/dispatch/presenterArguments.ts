import { computeBindingPlan, type BindingPlan } from '../wire/binding.js';
import type { InvocationContext } from '../wire/Invocation.js';
import type { PresenterEntry } from '../descriptor/frond.js';
import type { ArgumentResolver } from './ArgumentResolver.js';
import type { PresenterArgs } from './PresenterExecutor.js';

/**
 * Where each computed field's extra arguments come from — read off the declaration, so a
 * field that takes only the page is absent and asks for nothing.
 */
export function presenterPlans(
  meta: PresenterEntry,
  collectorTypes: Set<string>,
): Map<string, BindingPlan> {
  const plans = new Map<string, BindingPlan>();
  for (const field of meta.fieldMeta) {
    if (!field.params?.length) continue;
    plans.set(field.name, computeBindingPlan(field.params, collectorTypes));
  }

  return plans;
}

/** The invocation-dependent arguments of every computed presenter field. */
export async function presenterArguments(
  plans: Map<string, BindingPlan>,
  invocation: InvocationContext,
  resolver: ArgumentResolver,
): Promise<PresenterArgs> {
  const argumentsByField: PresenterArgs = {};

  for (const [field, plan] of plans) {
    argumentsByField[field] = await resolver.resolve(plan, invocation);
  }

  return argumentsByField;
}
