import type { FrondDescriptor } from './scan/frond.js';
import { registrationKeyOf } from '@fougere/schema';
import { repositoryKeyOf } from './prefab/repository.js';
import { ormKeyOf } from './orm.js';
import { presenterKeyOf } from './prefab/presenter.js';
import { collectorKeyOf } from './prefab/collector.js';

/**
 * What a rule found in an app.
 *
 * `message` is the sentence the rule replaces — the prose a human used to have
 * to remember. `Known issues` says "Keep collectors in the consuming frond";
 * this is that sentence, told about a specific handler, by something that runs.
 */
export interface Violation {
  /** Rule name, stable — 'cross-frond-dependency'. */
  rule: string;
  /**
   * What it costs, decided by the rule that raises it — never by whoever renders it.
   *
   * The two rules here are not the same animal: a cross-frond dependency resolves
   * today and stops resolving the day the other frond answers over the wire, while a
   * collector declared elsewhere is already wrong in one process. A reader holding a
   * table of rule names would be a second opinion on a fact the rule already has.
   */
  severity: 'blocking' | 'warning';
  /** The frond the subject lives in. */
  frond: string;
  /** What violates it — 'PostHandler'. */
  subject: string;
  /** Where to go and look. */
  filePath: string;
  /**
   * What the subject reaches for, and where it actually lives.
   *
   * `frond` above is the CONSUMER; the target used to exist only inside the
   * sentence. A reader that has to parse prose to learn which frond a violation
   * points at is a second opinion on a fact the checker already held — so the
   * boot can ask "does this violation target a frond named in `remotes:`?" by
   * reading a field.
   */
  dependsOn: { key: string; frond: string; kind: string };
  /** What breaks, and what the caller gets instead. */
  message: string;
}

/** A dependency declared in a frond's scope, and what kind of thing it is. */
type Registration = { frond: string; kind: string };

/**
 * The container keys a frond registers in its own scope, keyed as a handler's
 * `deps` spell them — DI resolves by type name, so both sides are PascalCase.
 *
 * Every key comes from the function that states it, never from a derivation
 * respelled here: a second reader that spells one differently finds nothing and
 * reports nothing wrong, which is the failure mode a checker must not have.
 */
function registrationsOf(frond: FrondDescriptor): Map<string, Registration> {
  const out = new Map<string, Registration>();
  const put = (key: string, kind: string) => out.set(key, { frond: frond.name, kind });

  for (const p of frond.providers) put(p.ctor.name, 'provider');
  for (const p of frond.presenters) put(presenterKeyOf(p.entityName), 'presenter');
  for (const c of frond.collectors) put(collectorKeyOf(c.typeName), 'collector');
  for (const e of frond.entities) {
    put(ormKeyOf(e.name), 'ORM');
    put(repositoryKeyOf(e.name), 'repository');
  }
  return out;
}

/**
 * Everything in a frond that is constructed by DI, so carries `deps`.
 * Handlers, presenters and collectors are all built from a constructor whose
 * argument types the scan read; each one can therefore reach across.
 */
function injectablesOf(frond: FrondDescriptor) {
  return [
    ...frond.handlers.map((h) => ({ name: h.ctor.name, deps: h.deps, filePath: h.filePath })),
    ...frond.presenters.map((p) => ({ name: p.ctor.name, deps: p.deps, filePath: p.filePath })),
    ...frond.collectors.map((c) => ({ name: c.ctor.name, deps: c.deps, filePath: c.filePath })),
  ];
}

/**
 * Does this app survive being split?
 *
 * A frond runs in-process or in its own process behind JSON-RPC with identical
 * user code — that is the whole claim. What the claim does not say is that
 * *every* app survives the move: a dependency that crosses a frond boundary
 * resolves today because both scopes live in one container, and resolves to
 * nothing the day the other frond answers over the wire.
 *
 * The question only exists where a module boundary is meant to become a process
 * boundary later. Where every inter-module call is already remote there is
 * nothing to check, and where no exit is planned there is nothing to check
 * either. Here it means something, and until now it had no answer.
 *
 * Pure over `app.fronds`: no mount, no process, no file. Call it from a test.
 */
export function verify(app: { fronds: readonly FrondDescriptor[] }): Violation[] {
  const index = new Map<string, Registration>();
  for (const frond of app.fronds) {
    for (const [key, reg] of registrationsOf(frond)) index.set(key, reg);
  }

  // Which frond declares a collector for which entity. Collectors are the one
  // thing a handler asks for by OPERATION PARAMETER, never by constructor, so
  // they need their own index and their own rule.
  const collectorFronds = new Map<string, string>();
  for (const frond of app.fronds) {
    for (const c of frond.collectors) collectorFronds.set(c.typeName, frond.name);
  }

  const violations: Violation[] = [];
  for (const frond of app.fronds) {
    // Rule 1 — a constructor dependency declared in another frond's scope.
    // Façade keys are exempt by construction, not by omission: a `Facade<X>`
    // dependency is spelled camelCase (`articleHandler`) while every type key
    // here is PascalCase, so the two namespaces cannot collide. The façade IS
    // the sanctioned crossing — see tests/cross-frond.test.ts.
    for (const subject of injectablesOf(frond)) {
      for (const dep of subject.deps) {
        const declared = index.get(dep);
        // Not in the index at all = a builtin (Logger, Config), a
        // façade key, or an unresolved name. None is a boundary crossing, and
        // an unresolved dependency is the container's complaint, not this rule's.
        if (!declared || declared.frond === frond.name) continue;
        violations.push({
          rule: 'cross-frond-dependency',
          severity: 'warning',
          frond: frond.name,
          subject: subject.name,
          filePath: subject.filePath,
          dependsOn: { key: dep, frond: declared.frond, kind: declared.kind },
          message:
            `${subject.name} depends on ${dep}, the ${declared.kind} of frond '${declared.frond}'. ` +
            `Each frond registers into its own scope, so this does not resolve here. ` +
            `Declare ${dep} in '${frond.name}', or reach '${declared.frond}' through its ` +
            `façade — the one sanctioned crossing.`,
        });
      }
    }

    // Rule 2 — an operation parameter that wanted a collector this frond has not
    // got. `computeBindingPlan` gates the collector branch on the frond's OWN
    // collector set (`collectorTypeNames`, bootstrap.ts), then falls through to
    // branch 4, "Everything else — body" (`computeBindingPlan`, binding.ts). So the
    // parameter does not go missing: it carries what the caller sent. Measured in
    // tests/collector-frond.test.ts.
    const own = new Set(frond.collectors.map((c) => c.typeName));
    for (const handler of frond.handlers) {
      for (const [opName, op] of handler.operations) {
        for (const param of op.signature?.params ?? []) {
          // Same key the scan writes and the binding plan looks up — `toLowerCase()`
          // here missed a two-word type in BOTH directions: neither confirmed the
          // collector was local nor found it elsewhere, so the rule reported nothing.
          const wanted = registrationKeyOf(param.type.name);
          if (own.has(wanted)) continue;
          const elsewhere = collectorFronds.get(wanted);
          // No collector anywhere for that type = an ordinary body parameter,
          // which is what branch 4 is FOR. Only a collector that exists in the
          // wrong place makes the fall-through a lie.
          if (!elsewhere) continue;
          violations.push({
            rule: 'collector-in-another-frond',
            severity: 'blocking',
            frond: frond.name,
            subject: `${handler.ctor.name}.${opName}(${param.name})`,
            filePath: handler.filePath,
            dependsOn: { key: collectorKeyOf(wanted), frond: elsewhere, kind: 'collector' },
            message:
              `'${param.name}' is typed ${param.type.name}, and the collector that produces one ` +
              `is declared in frond '${elsewhere}'. A binding plan only sees its own frond's ` +
              `collectors, so this parameter falls through to the request body — it receives ` +
              `what the CALLER sent. An op that judges it (\`if (${param.name}.role !== 'admin') throw\`) ` +
              `is judging the caller's own claim about themselves. ` +
              `Move the collector into '${frond.name}'.`,
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
  const lines = violations.map((v) => `  [${v.rule}] ${v.frond}/${v.subject}\n    ${v.message}\n    ${v.filePath}`);
  throw new Error(`${violations.length} violation(s) — this app does not survive a split:\n${lines.join('\n')}`);
}
