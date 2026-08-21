import { vi, type Mock } from 'vitest';
import type { Container } from '@fougere/container';
import type { App } from '@fougere/core';

/** Anything a provider can be declared as: a class the container knows how to build. */
export type Port = abstract new (...args: never[]) => unknown;

/** The double handed in place of a port — one spy per method the port declares. */
export type Stub<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? Mock : T[K] };

/**
 * The methods a port declares, read from the prototype chain at runtime.
 *
 * Not written by hand and not read from the AST: `ProviderEntry` keeps `ctor`, `deps` and
 * `filePath` and never the methods, while the prototype has them all along. So a double
 * carries exactly what the port carries and gains a method the day the port does — which
 * is the failure `ports.test.ts` records, a `charge is not a function` from a stand-in
 * that did not carry what its type promised.
 *
 * Walks the chain because a port may itself extend one; stops at `Object.prototype`,
 * whose members belong to no port.
 */
export function methodsOf(port: Port): string[] {
  const found = new Set<string>();
  let proto: object | null = port.prototype as object;
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const declared = Object.getOwnPropertyDescriptor(proto, name);
      if (typeof declared?.value === 'function') found.add(name);
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return [...found];
}

/**
 * A double for a port: every method present, every call recorded, nothing returned.
 *
 * What it RETURNS is not derivable and the value is the caller's to state — a service's
 * return type is a bare TypeScript type, erased at runtime, with no declared fields for
 * anything to build from. The same line the whole package sits on: what Fougere's
 * vocabulary declares can be derived, arbitrary code cannot.
 */
export function stubOf<T>(port: Port): Stub<T> {
  const double: Record<string, Mock> = {};
  for (const method of methodsOf(port)) double[method] = vi.fn();
  return double as Stub<T>;
}

/**
 * Put doubles in front of ports, in every frond scope that answers under their name.
 *
 * After the boot rather than through `ports:`, because the container resolves lazily: a
 * provider is built on first `resolve`, so a value registered before any call is the one
 * a handler receives. `registerValue` also marks it as not the container's to dispose,
 * which is right — the test made it.
 *
 * A port nobody answers under is REFUSED by name, for the reason `ports:` refuses a key
 * that matched nothing: a double that silently stands in front of no one reads as a test
 * that covered a case it never reached.
 */
export function installStubs(app: App, ports: Port[]): Map<Port, Stub<unknown>> {
  const doubles = new Map<Port, Stub<unknown>>();
  const scopes = app.fronds.map((frond) => app.resolve<Container>(`frond:${frond.name}`));

  for (const port of ports) {
    const answering = scopes.filter((scope) => scope.has(port.name));
    if (answering.length === 0) {
      throw new Error(
        `[stub] ${port.name} — nothing answers under that name in any frond. `
        + 'A port is a class a provider extends; a class nobody extends is an ordinary service.',
      );
    }
    const double = stubOf(port);
    for (const scope of answering) scope.registerValue(port.name, double);
    doubles.set(port, double);
  }
  return doubles;
}
