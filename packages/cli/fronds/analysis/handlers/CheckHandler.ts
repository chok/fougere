import { buildGraph, clusterEntities, crossFrondImports, resolveContracts, type ScanDiagnostic } from '@fougere/core';
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
 *     receives nothing;
 *   - a relative import that resolves into another frond — a colocation constraint
 *     nothing declares, which holds until the day the other frond is not on this disk.
 *
 * A rule about an ABSENCE is only sound if the analysis attests it looked, which
 * is why the first bullet had to exist before this command could.
 */
/** Shared with `fougere graph` — one threshold, so the two never disagree. */
const DOMAIN_SPLIT_MIN_ENTITIES = 6;

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

    /**
     * Entity groups with no `ref()` between them, in one frond. Reported as a FACT, not a
     * verdict: it means either a missing relation or a frond that has not been named, and
     * nothing here can tell which. `fougere graph` shows the groups.
     */
    if (fronds.length === 1) {
      // `clusterEntities`, not `suggestSplit`: the latter invents a cut on a connected
      // graph, which is its job and not this question. Here only real components count.
      const nodes = buildGraph(fronds);
      const clusters = clusterEntities(nodes);
      // Same threshold as `fougere graph`'s own tip: below it, two components are a small
      // app that has not grown its links yet, not a frond holding two domains.
      if (clusters.length > 1 && nodes.size >= DOMAIN_SPLIT_MIN_ENTITIES) {
        findings.push({
          severity: 'warning',
          code: 'frond-holds-several-domains',
          filePath: fronds[0].source.path,
          message: `'${fronds[0].name}': ${clusters.length} entity groups with no relation between `
            + `them (${clusters.map((c) => c.name).join(', ')}). Either a relation is missing, or `
            + `they are separate fronds — see \`fougere graph\`.`,
        });
      }
    }

    /**
     * A warning, not a refusal: it resolves today and the app runs. What it costs is
     * paid once, late — the day the frond it reaches into is deployed on its own.
     */
    for (const reach of await crossFrondImports(fronds)) {
      findings.push({
        severity: 'warning',
        code: reach.rule,
        filePath: reach.filePath,
        message: reach.message,
      });
    }

    return { fronds: fronds.length, handlers, findings };
  }
}

/** A scan diagnostic IS a finding — same vocabulary, so the renderer has one shape. */
function asFinding(d: ScanDiagnostic): Finding {
  return { severity: d.severity, code: d.code, filePath: d.filePath, message: d.message };
}
