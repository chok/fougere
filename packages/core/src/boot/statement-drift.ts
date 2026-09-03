/**
 * Where a STATED contract and the signature it is about have stopped agreeing.
 *
 * `frond.config.ts` states an operation's contract and wins over the scan — that order is
 * deliberate, and it is the only answer for a method inherited from an installed base class
 * the workspace scan cannot see. But winning silently is how a statement made about
 * `publish(id: string)` keeps applying after the parameter was renamed to `postId`: the
 * façade binds what the config said, the method receives `undefined`, and nothing anywhere
 * says the two disagree.
 *
 * So this compares, and only where BOTH exist — a statement about a signature the scan
 * never read is not drift, it is the case config was built for. It is a `warning` and not
 * a refusal: the statement is still the author's word, and a boot that ran yesterday must
 * not stop running because a parameter moved. What it must not do is stay quiet.
 */
import type { FrondDescriptor, HandlerEntry } from '../descriptor/frond.js';
import type { ScanDiagnostic } from '../scan/result.js';
import type { BindingPlan } from '../wire/binding.js';
import type { Signature } from '../wire/signature.js';

/** The parameters a binding plan names, against the ones the method declares. */
function namesDisagreeing(plan: BindingPlan, signature: Signature): string[] {
  const declared = new Set(signature.params.map((p: { name: string }) => p.name));

  return plan.map((b) => b.name).filter((name) => !declared.has(name));
}

/**
 * What a frond's stated contracts no longer match.
 *
 * Read by `resolveEffectiveOperations`, so the same answer reaches `fougere check` and a
 * boot — one comparison, two readers, no second opinion to drift on its own.
 */
export function statementDrift(frond: FrondDescriptor, handler: HandlerEntry): ScanDiagnostic[] {
  const found: ScanDiagnostic[] = [];

  for (const [name, override] of Object.entries(frond.operationsOverrides ?? {})) {
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
      message: `frond.config.ts binds ${orphans.map((o) => `\`${o}\``).join(', ')} on `
        + `${handler.ctor.name}.${name}, which declares (${signature.params.map((p: { name: string }) => p.name).join(', ')}). `
        + `The statement wins, so those parameters receive nothing.`,
    });
  }

  return found;
}
