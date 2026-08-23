import {
  buildGraph,
  clusterEntities,
  resolveEffectiveOperations,
  type ScanDiagnostic,
} from '@fougere/core';
import { crossFrondImports } from '@fougere/core/node';
import ProjectScan from '../services/ProjectScan.js';

/** One thing that does not hold, in the terms of whoever has to fix it. */
export interface Finding {
  severity: 'blocking' | 'warning';
  /** Stable rule name — the same vocabulary a scan diagnostic uses. */
  code: string;
  /** Where to go and look. */
  filePath: string;
  /**
   * What the finding is ABOUT — `PostHandler.whoNull(user)` — when the rule holds it
   * as a fact rather than inside its sentence. Two ops of one handler breaking the
   * same rule read as one repeated line without it.
   */
  subject?: string;
  /** What is wrong, and what it costs. One sentence. */
  message: string;
}

export interface CheckResult {
  fronds: number;
  handlers: number;
  findings: Finding[];
}

/** Shared with `fougere graph` — one threshold, so the two never disagree. */
const DOMAIN_SPLIT_MIN_ENTITIES = 6;

/**
 * What does not hold in this app — derived from its declarations, not from tests.
 *
 * It scans rather than boots — see `ProjectScan`, which states what that costs.
 *
 * It raises no operation-resolution rule of its own: those findings come from the same
 * EffectiveOperation resolver boot consumes. The remaining findings come from their
 * existing owners — scan diagnostics, the import reader and domain clustering. A second
 * opinion here would report what the runtime does not serve, precisely what a checker
 * must avoid.
 *
 * A rule about an ABSENCE is only sound if the analysis attests it looked, which is
 * why the scan's diagnostics had to exist before this command could.
 */
export default class CheckHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Report what does not hold in a Fougere app, without booting it. */
  async execute(input: { root?: string }): Promise<CheckResult> {
    const { fronds, diagnostics, config } = await this.projectScan.at(input.root);
    // This is the same pure resolution the boot consumes. No app lifecycle, database,
    // migration, seed or adapter mount is needed for a global semantic check.
    const model = resolveEffectiveOperations(fronds, {
      diagnostics,
      remotes: config.remotes,
      adapters: config.adapters,
    });
    const findings: Finding[] = model.diagnostics.map(asFinding);
    const handlers = fronds.reduce((count, frond) => count + frond.handlers.length, 0);

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
  return {
    severity: d.severity,
    code: d.code,
    filePath: d.filePath,
    subject: d.subject,
    message: d.message,
  };
}
