import type { App, FrondDescriptor } from './types.js';
import { repositoryKeyOf } from './repository.js';

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
  /** The frond the subject lives in. */
  frond: string;
  /** What violates it — 'PostHandler'. */
  subject: string;
  /** Where to go and look. */
  filePath: string;
  /** What breaks, in the terms of the split. */
  message: string;
}

/** A dependency declared in a frond's scope, and what kind of thing it is. */
type Registration = { frond: string; kind: string };

/**
 * The container keys a frond registers in its own scope, keyed as a handler's
 * `deps` spell them — DI resolves by type name, so both sides are PascalCase.
 *
 * These derivations mirror `bootstrap.ts` at registration time, and that mirror
 * is the finding: nothing states a frond's keys once. Writing this second reader
 * is what makes extracting them worth doing rather than merely tidy.
 */
function registrationsOf(frond: FrondDescriptor): Map<string, Registration> {
  const pascal = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
  const out = new Map<string, Registration>();
  const put = (key: string, kind: string) => out.set(key, { frond: frond.name, kind });

  for (const p of frond.providers) put(p.ctor.name, 'provider');
  for (const p of frond.presenters) put(`${pascal(p.entityName)}Presenter`, 'presenter');
  for (const c of frond.collectors) put(`${pascal(c.entityName)}Collector`, 'collector');
  for (const e of frond.entities) {
    put(`${pascal(e.name)}Orm`, 'ORM');
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
 * The gradient is the one question no other framework can ask. Nest has nothing
 * to check — every inter-module call is already remote, so nothing changes when
 * you split. Spring Modulith has nothing to check either — it plans no exit.
 * Here the question means something, and until now it had no answer.
 *
 * Pure over `app.fronds`: no mount, no process, no file. Call it from a test.
 */
export function verify(app: Pick<App, 'fronds'>): Violation[] {
  const index = new Map<string, Registration>();
  for (const frond of app.fronds) {
    for (const [key, reg] of registrationsOf(frond)) index.set(key, reg);
  }

  // Which frond declares a collector for which entity. Collectors are the one
  // thing a handler asks for by OPERATION PARAMETER, never by constructor, so
  // they need their own index and their own rule.
  const collectorFronds = new Map<string, string>();
  for (const frond of app.fronds) {
    for (const c of frond.collectors) collectorFronds.set(c.entityName, frond.name);
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
        // Not in the index at all = a builtin (Logger, Config, EventBus), a
        // façade key, or an unresolved name. None is a boundary crossing, and
        // an unresolved dependency is the container's complaint, not this rule's.
        if (!declared || declared.frond === frond.name) continue;
        violations.push({
          rule: 'cross-frond-dependency',
          frond: frond.name,
          subject: subject.name,
          filePath: subject.filePath,
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
    // collector set (bootstrap.ts:167), then falls through to branch 4,
    // "Everything else — body" (binding.ts:90). So the parameter does not go
    // missing: it carries what the caller sent. Measured in
    // tests/collector-frond.test.ts.
    const own = new Set(frond.collectors.map((c) => c.entityName));
    for (const handler of frond.handlers) {
      for (const [opName, op] of handler.operations) {
        for (const param of op.signature?.params ?? []) {
          const wanted = param.type.name.toLowerCase();
          if (own.has(wanted)) continue;
          const elsewhere = collectorFronds.get(wanted);
          // No collector anywhere for that type = an ordinary body parameter,
          // which is what branch 4 is FOR. Only a collector that exists in the
          // wrong place makes the fall-through a lie.
          if (!elsewhere) continue;
          violations.push({
            rule: 'collector-in-another-frond',
            frond: frond.name,
            subject: `${handler.ctor.name}.${opName}(${param.name})`,
            filePath: handler.filePath,
            message:
              `'${param.name}' is typed ${param.type.name}, and the collector that produces one ` +
              `is declared in frond '${elsewhere}'. A binding plan only sees its own frond's ` +
              `collectors, so this parameter falls through to the request body — it receives ` +
              `what the caller sent, not what the collector would have said. ` +
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
export function assertSplittable(app: Pick<App, 'fronds'>): void {
  const violations = verify(app);
  if (violations.length === 0) return;
  const lines = violations.map((v) => `  [${v.rule}] ${v.frond}/${v.subject}\n    ${v.message}\n    ${v.filePath}`);
  throw new Error(`${violations.length} violation(s) — this app does not survive a split:\n${lines.join('\n')}`);
}
