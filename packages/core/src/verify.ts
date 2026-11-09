import type { FrondDescriptor } from './descriptor/FrondDescriptor.js';
import type { Diagnostic } from './diagnostic.js';
import { lowerFirst } from '@fougere/schema';
import { repositoryKeyOf } from './prefab/Repository.js';
import { storageKeyOf } from './storage/Storage.js';
import { presenterKeyOf } from './prefab/presenter.js';
import { collectorKeyOf } from './prefab/collector.js';
import { OperationOverrides } from './descriptor/OperationOverrides.js';
import { collectorsInScope } from './module/collector/operation.js';

/** A subject declared in one frond and reached from another — the rules below find no other kind. */
export type Misplaced = Diagnostic & {
  frond: string;
  subject: string;
  /** What the subject reaches for, and where it actually lives. */
  dependsOn: { key: string; frond: string; kind: string };
};

type Registration = { frond: string; kind: string };

function ancestors(frond: FrondDescriptor, byName: Map<string, FrondDescriptor>): Set<string> {
  const above = new Set<string>();
  for (let at = frond.extends; at !== undefined && !above.has(at); at = byName.get(at)?.extends) {
    above.add(at);
  }

  return above;
}

function registrationsOf(frond: FrondDescriptor): Map<string, Registration> {
  const out = new Map<string, Registration>();
  const put = (key: string, kind: string) => out.set(key, { frond: frond.name, kind });

  for (const provider of frond.providers) put(provider.ctor.name, 'provider');
  for (const presenter of frond.presenters) put(presenterKeyOf(presenter.entityName), 'presenter');
  for (const collector of frond.collectors) put(collectorKeyOf(collector.typeName), 'collector');
  for (const e of frond.entities) {
    put(storageKeyOf(e.name), 'storage');
    put(repositoryKeyOf(e.name), 'repository');
  }

  return out;
}

function injectablesOf(frond: FrondDescriptor) {
  return [
    ...frond.handlers.map((h) => ({ name: h.ctor.name, deps: h.deps, filePath: h.filePath })),
    ...frond.presenters.map((p) => ({ name: p.ctor.name, deps: p.deps, filePath: p.filePath })),
    ...frond.collectors.map((c) => ({ name: c.ctor.name, deps: c.deps, filePath: c.filePath })),
  ];
}

/** Whether this app survives being split into processes. */
export function verify(app: { fronds: readonly FrondDescriptor[] }): Misplaced[] {
  const index = new Map<string, Registration>();
  const byName = new Map(app.fronds.map((frond) => [frond.name, frond]));
  for (const frond of app.fronds) {
    for (const [key, reg] of registrationsOf(frond)) index.set(key, reg);
  }

  const collectorFronds = new Map<string, string>();
  for (const frond of app.fronds) {
    for (const collector of frond.collectors) collectorFronds.set(collector.typeName, frond.name);
  }

  const violations: Misplaced[] = [];
  for (const frond of app.fronds) {
    for (const subject of injectablesOf(frond)) {
      for (const dep of subject.deps) {
        const declared = index.get(dep);
        if (!declared || declared.frond === frond.name) continue;
        if (ancestors(frond, byName).has(declared.frond)) continue;
        violations.push({
          code: 'cross-frond-dependency',
          severity: 'warning',
          frond: frond.name,
          subject: subject.name,
          filePath: subject.filePath,
          dependsOn: { key: dep, frond: declared.frond, kind: declared.kind },
          message:
            `${subject.name} asks for ${dep}, which belongs to the frond '${declared.frond}', so '${frond.name}' cannot see it. `
            + `Move ${dep} into '${frond.name}', or call '${declared.frond}' through its handler's facade.`,
        });
      }
    }

    const own = new Set(collectorsInScope(frond, app.fronds).map((collector) => collector.typeName));
    const declared = OperationOverrides.of(frond);
    for (const handler of frond.handlers) {
      for (const [opName, op] of handler.operations) {
        const declaredBinding = declared.get(handler.address, opName)?.binding ?? [];
        for (const param of op.signature?.params ?? []) {
          if (declaredBinding.some((entry) => entry.name === param.name)) continue;
          const wanted = lowerFirst(param.type.name);
          if (own.has(wanted)) continue;
          const inOtherFronds = collectorFronds.get(wanted);
          if (!inOtherFronds) continue;
          violations.push({
            code: 'collector-in-another-frond',
            severity: 'warning',
            frond: frond.name,
            subject: `${handler.ctor.name}.${opName}(${param.name})`,
            filePath: handler.filePath,
            dependsOn: { key: collectorKeyOf(wanted), frond: inOtherFronds, kind: 'collector' },
            message:
              `${handler.ctor.name}.${opName} takes ${param.name} from the request, but the frond '${inOtherFronds}' has a `
              + `${param.type.name} collector that '${frond.name}' cannot see.\n`
              + `  - To use that collector: move it into '${frond.name}'.\n`
              + `  - To keep the request: declare it in ${frond.name}/frond.config.ts:\n`
              + `      operations: { '${handler.address}.${opName}': { binding: [{ name: '${param.name}', source: { kind: 'input' } }] } }`,
          });
        }
      }
    }
  }

  return violations;
}

/** The same verdict as an assertion, naming every rule that failed. */
export function assertSplittable(app: { fronds: readonly FrondDescriptor[] }): void {
  const violations = verify(app);
  if (violations.length === 0) return;
  const lines = violations.map((v) => `  [${v.code}] ${v.frond}/${v.subject}\n    ${v.message}\n    ${v.filePath}`);
  throw new Error(`${violations.length} problem(s) would break this app once its fronds run in separate processes:\n${lines.join('\n')}`);
}
