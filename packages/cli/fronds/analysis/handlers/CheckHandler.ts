import { Shapes } from '@fougere/schema';
import safeRegex from 'safe-regex';
import {
  buildGraph,
  clusterEntities,
  resolveEffectiveOperations,
  type Diagnostic,
} from '@fougere/core';
import { adaptersOf, crossFrondImports, handlerDeclarations, outsideConventions } from '@fougere/compiler';
import { resolveConventions } from '@fougere/core';
import ProjectScan from '../services/ProjectScan.js';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FACADE_OUT, DEFAULT_OUT } from './BuildHandler.js';
import { remotesOf, appOptionsFileIn, appOptionsIn } from '@fougere/core/node';
import type { FrondDescriptor } from '@fougere/core';

export interface CheckResult {
  fronds: number;
  handlers: number;
  findings: Diagnostic[];
}

const DOMAIN_SPLIT_MIN_ENTITIES = 6;

/** What does not hold in this app — derived from its declarations, not from tests. */
export default class CheckHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Report what does not hold in a Fougere app, without booting it. */
  async execute(input: { root?: string }): Promise<CheckResult> {
    const { fronds, diagnostics, config, root } = await this.projectScan.at(input.root);
    const model = resolveEffectiveOperations(fronds, {
      diagnostics,
      remotes: remotesOf(config),
      protocols: config.protocols,
    });
    const findings: Diagnostic[] = [...model.diagnostics];
    const handlers = fronds.reduce((count, frond) => count + frond.handlers.length, 0);

    if (fronds.length === 1) {
      const nodes = buildGraph(fronds);
      const clusters = clusterEntities(nodes);
      if (clusters.length > 1 && nodes.size >= DOMAIN_SPLIT_MIN_ENTITIES) {
        findings.push({
          severity: 'warning',
          code: 'frond-holds-several-domains',
          filePath: fronds[0].source.path,
          message: `The frond '${fronds[0].name}' has ${clusters.length} groups of entities with no relation between them `
            + `(${clusters.map((c) => c.name).join(', ')}). A ref() is missing, or they are separate fronds — see \`fougere graph\`.`,
        });
      }
    }

    const known = await adaptersOf(root);
    if (known.length > 0) {
      for (const frond of fronds) {
        for (const entity of frond.entities) {
          for (const name of Object.keys(entity.entityClass.getAdapters() ?? {})) {
            if (known.includes(name)) continue;
            findings.push({
              severity: 'warning',
              code: 'unknown-adapter',
              filePath: entity.filePath,
              subject: entity.name,
              message: `has \`adapters: { ${name} }\`, but no installed adapter is named ${name} `
                + `(installed: ${known.join(', ') || 'none'}). Check the spelling, or add the dependency.`,
            });
          }
        }
      }
    }

    for (const frond of fronds) {
      for (const entity of frond.entities) {
        for (const [key, field] of Object.entries(entity.entityClass.getFields())) {
          for (const pattern of Shapes.patterns(field.shape)) {
            if (safeRegex(pattern)) continue;
            findings.push({
              severity: 'warning',
              code: 'super-linear-pattern',
              filePath: entity.filePath,
              subject: `${entity.name}.${key}`,
              message: `has \`pattern: ${JSON.stringify(pattern)}\`, a nested repetition that can take seconds `
                + 'to check on some inputs and block the server. Rewrite the repeated group, or limit the field with `max`.',
            });
          }
        }
      }
    }

    for (const reach of await crossFrondImports(fronds)) {
      findings.push({
        severity: 'warning',
        code: reach.rule,
        filePath: reach.filePath,
        message: reach.message,
      });
    }

    const conventions = resolveConventions(config.conventions);

    for (const unplaced of await outsideConventions(fronds, conventions)) {
      findings.push({
        severity: 'warning',
        code: unplaced.rule,
        filePath: unplaced.filePath,
        subject: unplaced.frond,
        message: unplaced.message,
      });
    }

    for (const held of await handlerDeclarations(fronds, conventions)) {
      findings.push({
        severity: 'warning',
        code: held.rule,
        filePath: held.filePath,
        subject: `${held.handler}.${held.subject}`,
        message: held.message,
      });
    }

    findings.push(...facadeFindings(root, fronds));
    findings.push(...workerFindings(root, config.state));
    findings.push(...await statementFindings(root, fronds));

    return { fronds: fronds.length, handlers, findings };
  }
}

async function statementFindings(root: string, fronds: readonly FrondDescriptor[]): Promise<Diagnostic[]> {
  const file = appOptionsFileIn(root);
  if (!file) return [];
  const { fronds: stated } = await appOptionsIn(file);
  const findings: Diagnostic[] = [];

  for (const frond of fronds) {
    const declared = stated.find((one) => one.name === frond.name);
    for (const handler of frond.handlers) {
      const listed = declared?.handlers.find((one) => one.ctor.name === handler.ctor.name);
      if (!listed) {
        findings.push({
          severity: 'warning',
          code: 'handler-unstated',
          filePath: file,
          subject: handler.ctor.name,
          message: `${handler.ctor.name} is in the code of the frond '${frond.name}' but not in fronds.ts, so the app starts without it.`,
        });
        continue;
      }
      for (const op of handler.operations.keys()) {
        if (listed.operations.has(op)) continue;
        findings.push({
          severity: 'warning',
          code: 'operation-unstated',
          filePath: file,
          subject: `${handler.ctor.name}.${op}`,
          message: `${handler.ctor.name}.${op} is public but not in fronds.ts, so the app starts without it. `
            + `Add it: operations: { ${op}: { params: { … }, output: … } }, or make the method private.`,
        });
      }
    }
  }

  return findings;
}

function workerFindings(root: string, state: Record<string, unknown> | undefined): Diagnostic[] {
  if (!state || Object.keys(state).length === 0) return [];
  const file = WRANGLER_FILES.map((name) => join(root, name)).find((path) => statSync(path, { throwIfNoEntry: false }));
  if (!file || /["']nodejs_compat["']/.test(readFileSync(file, 'utf8'))) return [];

  return [{
    severity: 'warning',
    code: 'state-without-async-context',
    filePath: file,
    subject: Object.keys(state).join(', '),
    message: '`state:` keeps what callers write, and this Worker has no `nodejs_compat`, so every `state.set` is refused. '
      + 'Add "nodejs_compat" to compatibility_flags.',
  }];
}

const WRANGLER_FILES = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'];

function facadeFindings(root: string, fronds: readonly { handlers: readonly { filePath: string }[] }[]): Diagnostic[] {
  const facade = join(root, dirname(DEFAULT_OUT), FACADE_OUT);
  const written = statSync(facade, { throwIfNoEntry: false })?.mtimeMs;
  if (written === undefined) return [];

  const newer = fronds
    .flatMap((frond) => frond.handlers)
    .filter((handler) => (statSync(handler.filePath, { throwIfNoEntry: false })?.mtimeMs ?? 0) > written);

  if (newer.length === 0) return [];

  return [{
    severity: 'warning',
    code: 'facade-stale',
    filePath: facade,
    subject: `${newer.length} handler${newer.length > 1 ? 's' : ''}`,
    message: '@fronds/facade is older than the handlers, so pages are checked against old operations. Run `fougere build`.',
  }];
}

