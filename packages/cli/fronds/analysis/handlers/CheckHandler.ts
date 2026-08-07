import { resolveContracts, type ScanDiagnostic } from '@fougere/core';
import ProjectScan from '../services/ProjectScan.js';

/** One thing that does not hold, in the terms of whoever has to fix it. */
export interface Finding {
  severity: 'blocking' | 'warning';
  /** Stable rule name — the same vocabulary a scan diagnostic uses. */
  code: string;
  /** Where to go and look. */
  filePath: string;
  /** What is wrong, and what it costs. One sentence. */
  message: string;
}

export interface CheckResult {
  fronds: number;
  handlers: number;
  findings: Finding[];
}

/**
 * What does not hold in this app — derived from its declarations, not from tests.
 *
 * It scans rather than boots — see `ProjectScan`, which states what that costs.
 *
 * Two rules today, and the shape for the rest:
 *
 *   - what the scan could not do (`ScanResult.diagnostics`) — an unreadable
 *     directory, a handler that would not parse, an `extends` it could not follow;
 *   - an operation whose parameters have no binding plan — it is served, and it
 *     receives nothing.
 *
 * A rule about an ABSENCE is only sound if the analysis attests it looked, which
 * is why the first bullet had to exist before this command could.
 */
export default class CheckHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Report what does not hold in a Fougere app, without booting it. */
  async execute(input: { root?: string }): Promise<CheckResult> {
    const { fronds, diagnostics } = await this.projectScan.at(input.root);
    const findings: Finding[] = diagnostics.map(asFinding);
    let handlers = 0;

    for (const frond of fronds) {
      const collectorEntityNames = new Set(frond.collectors.map((c) => c.entityName));
      for (const handler of frond.handlers) {
        handlers++;
        // The same merge the façade performs — asked for, not redone. A second
        // opinion here would report a contract the runtime does not serve.
        const contracts = resolveContracts(handler, frond.operationsOverrides, collectorEntityNames);

        for (const [op, contract] of contracts) {
          const params = contract.signature?.params.length ?? 0;
          if (params > 0 && !contract.binding) {
            findings.push({
              severity: 'blocking',
              code: 'operation-unbound',
              filePath: handler.filePath,
              message: `${handler.ctor.name}.${op} declares ${params} parameter(s) and has no `
                + `binding plan — it is served, and it receives none of them.`,
            });
          }
        }
      }
    }

    return { fronds: fronds.length, handlers, findings };
  }
}

/** A scan diagnostic IS a finding — same vocabulary, so the renderer has one shape. */
function asFinding(d: ScanDiagnostic): Finding {
  return { severity: d.severity, code: d.code, filePath: d.filePath, message: d.message };
}
