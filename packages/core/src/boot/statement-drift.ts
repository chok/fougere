/** Where a STATED contract and the signature it is about have stopped agreeing. */
import type { FrondDescriptor, HandlerEntry } from '../descriptor/frond.js';
import type { ScanDiagnostic } from '../scan/result.js';
import type { BindingPlan } from '../wire/binding.js';
import type { Signature } from '../wire/signature.js';

/** The parameters a binding plan names, against the ones the method declares. */
function namesDisagreeing(plan: BindingPlan, signature: Signature): string[] {
  const declared = new Set(signature.params.map((p: { name: string }) => p.name));

  return plan.map((b) => b.name).filter((name) => !declared.has(name));
}

/** What a frond's stated contracts no longer match. */
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
