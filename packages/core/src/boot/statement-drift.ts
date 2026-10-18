/** Where a STATED contract and the signature it is about have stopped agreeing. */
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import { OperationOverrides } from '../descriptor/OperationOverrides.js';
import type { Diagnostic } from '../diagnostic.js';
import type { BindingPlan } from '../wire/binding.js';
import type { Signature } from '../wire/Signature.js';

/** The parameters a binding plan names, against the ones the method declares. */
function namesDisagreeing(plan: BindingPlan, signature: Signature): string[] {
  const declared = new Set(signature.params.map((p: { name: string }) => p.name));

  return plan.map((b) => b.name).filter((name) => !declared.has(name));
}

/** What a frond's stated contracts no longer match. */
export function statementDrift(frond: FrondDescriptor, handler: HandlerEntry): Diagnostic[] {
  const found: Diagnostic[] = [];

  for (const [name, override] of OperationOverrides.of(frond).at(handler.address)) {
    if (!override.binding) continue;

    // The scan's own reading of this method. Absent means config is stating what nothing
    // read — an installed base class, a handler outside the workspace — which is legal.
    const signature = handler.operations.get(name)?.signature;
    if (!signature) continue;

    const orphans = namesDisagreeing(override.binding, signature);
    if (orphans.length === 0) continue;

    found.push({
      severity: 'warning',
      code: 'stated-binding-drifted',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}`,
      message: `frond.config.ts binds ${orphans.join(', ')} on ${handler.ctor.name}.${name}, which has no such parameter `
        + `(it has ${signature.params.map((p: { name: string }) => p.name).join(', ') || 'none'}). Fix the names in frond.config.ts.`,
    });
  }

  return found;
}

/**
 * A contract with no method under its name. The scan cannot produce one; a declaration can, and
 * its first call used to fail as `instance[method] is not a function` — a server error for what
 * is a typo in the declaration.
 */
export function unansweredOperations(
  frond: FrondDescriptor,
  handler: HandlerEntry,
  names: Iterable<string>,
): Diagnostic[] {
  const prototype = handler.ctor.prototype as Record<string, unknown>;

  return [...names]
    .filter((name) => typeof prototype[name] !== 'function')
    .map((name) => ({
      severity: 'blocking',
      code: 'operation-without-method',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}`,
      message: `${handler.ctor.name}.${name} is listed as an operation, but ${handler.ctor.name} has no method ${name}.`,
    }));
}
