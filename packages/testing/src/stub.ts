import { vi, type Mock } from 'vitest';
import type { Container } from '@fougere/container';
import type { App } from '@fougere/core';

/** Anything a provider can be declared as: a class the container knows how to build. */
export type Port = abstract new (...args: never[]) => unknown;

/** The double handed in place of a port — one spy per method the port declares. */
export type Stub<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? Mock : T[K] };

/** The methods a port declares, read from the prototype chain at runtime. */
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

/** A double for a port. */
export function stubOf<T>(port: Port): Stub<T> {
  const double: Record<string, Mock> = {};
  for (const method of methodsOf(port)) double[method] = vi.fn();
  return double as Stub<T>;
}

/** Put doubles in front of ports, in every frond scope that answers under their name. */
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
