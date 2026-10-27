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

/** A dependency declared in a frond's scope, and what kind of thing it is. */
type Registration = { frond: string; kind: string };

/** Everything above a frond in the tree — what its scope reaches by walking up. */
function ancestors(frond: FrondDescriptor, byName: Map<string, FrondDescriptor>): Set<string> {
  const above = new Set<string>();
  for (let at = frond.extends; at !== undefined && !above.has(at); at = byName.get(at)?.extends) {
    above.add(at);
  }

  return above;
}

/**
 * The container keys a frond registers in its own scope, keyed as a handler's `deps` spell them —
 * DI resolves by type name, so both sides are PascalCase.
 */
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

/** Everything in a frond that is constructed by DI, so carries `deps`. */
function injectablesOf(frond: FrondDescriptor) {
  return [
    ...frond.handlers.map((h) => ({ name: h.ctor.name, deps: h.deps, filePath: h.filePath })),
    ...frond.presenters.map((p) => ({ name: p.ctor.name, deps: p.deps, filePath: p.filePath })),
    ...frond.collectors.map((c) => ({ name: c.ctor.name, deps: c.deps, filePath: c.filePath })),
  ];
}

/**
 * Does this app survive being split? A frond runs in-process or in its own process behind JSON-RPC
 * with identical user code — that is the whole claim.
 */
export function verify(app: { fronds: readonly FrondDescriptor[] }): Misplaced[] {
  const index = new Map<string, Registration>();
  const byName = new Map(app.fronds.map((frond) => [frond.name, frond]));
  for (const frond of app.fronds) {
    for (const [key, reg] of registrationsOf(frond)) index.set(key, reg);
  }

  // Which frond declares a collector for which entity. Collectors are the one
  // thing a handler asks for by OPERATION PARAMETER, never by constructor, so
  // they need their own index and their own rule.
  const collectorFronds = new Map<string, string>();
  for (const frond of app.fronds) {
    for (const collector of frond.collectors) collectorFronds.set(collector.typeName, frond.name);
  }

  const violations: Misplaced[] = [];
  for (const frond of app.fronds) {
    // Rule 1 — a constructor dependency declared in another frond's scope.
    // Façade keys are exempt by construction, not by omission: a `Facade<X>`
    // dependency is spelled camelCase (`articleHandler`) while every type key
    // here is PascalCase, so the two namespaces cannot collide. The façade IS
    // the sanctioned crossing — see tests/cross-frond.test.ts.
    for (const subject of injectablesOf(frond)) {
      for (const dep of subject.deps) {
        const declared = index.get(dep);
        // Not in the index at all = a builtin (Logger), a
        // façade key, or an unresolved name. None is a boundary crossing, and
        // an unresolved dependency is the container's complaint, not this rule's.
        if (!declared || declared.frond === frond.name) continue;
        // An ANCESTOR is not across: the frond tree says this one resolves what that one
        // declared, and its scope hangs off it. A sibling, a descendant or a stranger stays
        // refused — inheriting code is not calling a frond.
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

    // Rule 2 — a parameter read from the request while another frond collects its type. A warning,
    // not a refusal: `inviteUser(user: User)` reads its user from the request on purpose.
    const own = new Set(collectorsInScope(frond, app.fronds).map((collector) => collector.typeName));
    const declared = OperationOverrides.of(frond);
    for (const handler of frond.handlers) {
      for (const [opName, op] of handler.operations) {
        const declaredBinding = declared.get(handler.address, opName)?.binding ?? [];
        for (const param of op.signature?.params ?? []) {
          if (declaredBinding.some((entry) => entry.name === param.name)) continue;
          // Same key the scan writes and the binding plan looks up — `toLowerCase()`
          // here missed a two-word type in BOTH directions: neither confirmed the
          // collector was local nor found it elsewhere, so the rule reported nothing.
          const wanted = lowerFirst(param.type.name);
          if (own.has(wanted)) continue;
          const inOtherFronds = collectorFronds.get(wanted);
          // No collector anywhere for that type may be an ordinary input parameter.
          // Only a collector that exists in the wrong place makes that interpretation
          // provably false.
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

/**
 * The same verdict, as an assertion. Throws naming every rule that failed, so a
 * test is one line and its output is the sentence — not a diff of two objects.
 */
export function assertSplittable(app: { fronds: readonly FrondDescriptor[] }): void {
  const violations = verify(app);
  if (violations.length === 0) return;
  const lines = violations.map((v) => `  [${v.code}] ${v.frond}/${v.subject}\n    ${v.message}\n    ${v.filePath}`);
  throw new Error(`${violations.length} problem(s) would break this app once its fronds run in separate processes:\n${lines.join('\n')}`);
}
