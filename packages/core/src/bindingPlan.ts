import type { BindingPlan, BindingSource } from './wire/binding.js';
import type { Param } from './wire/Param.js';
import { BindingSources } from './BindingSources.js';

const PRIMITIVES = new Set(['string', 'number', 'boolean']);

function coercionFor(typeName: string): 'number' | 'boolean' | undefined {
  if (typeName === 'number') return 'number';
  if (typeName === 'boolean') return 'boolean';

  return undefined;
}

/** Build a BindingPlan from parsed method params. */
export function computeBindingPlan(
  params: Param[],
  collectorTypeNames: ReadonlySet<string>,
): BindingPlan {
  return params.map((param) => ({
    name: param.name,
    source: sourceOf(param, collectorTypeNames),
    optional: param.optional ?? false,
  }));
}

/** The first source that claims the parameter, then the request's own parts — the input last. */
function sourceOf(param: Param, collectorTypeNames: ReadonlySet<string>): BindingSource {
  for (const source of BindingSources.all) {
    const claimed = source.claim(param, collectorTypeNames);
    if (claimed) return claimed;
  }

  const typeName = param.type.name;
  if (typeName === 'InvocationContext') return { kind: 'context' };
  if (PRIMITIVES.has(typeName)) {
    const { field, identifies } = param.type;

    return { kind: 'param', name: param.name, coerce: coercionFor(typeName), ...(field && { field }), ...(identifies && { identifies }) };
  }

  return { kind: 'input' };
}
