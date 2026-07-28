/**
 * `SqlEntityOrm` honours `EntityOrm` — checked, not hoped.
 *
 * This package deliberately carries no dependency on `@fougere/core`: it matches
 * the port structurally, so nothing links the two at runtime. The cost of that
 * freedom is that the match was verified by nobody — change the port in `core`
 * and this implementation would drift without a single failure.
 *
 * So the check lives here, in a test: `@fougere/core` is a devDependency, the
 * import is type-only (erased at compile time), and the published surface stays
 * exactly as free of `core` as before. The assignment below IS the test — if the
 * port gains a method or changes a signature, this file stops compiling.
 */
import { describe, it, expect } from 'vitest';
import type { EntityOrm } from '@fougere/core';
import { SqlEntityOrm } from '../src/crud.js';

describe('the SQL ORM honours the port core declares', () => {
  it('is assignable to EntityOrm — verified by the compiler, not at runtime', () => {
    // The type-level assertion. `satisfies` would judge a value; the port is a
    // shape, so what must be judged is the class's instance type.
    type Honoured = SqlEntityOrm extends EntityOrm<Record<string, unknown>> ? true : never;
    const honoured: Honoured = true;

    expect(honoured).toBe(true);
  });

  it('carries the five operations plus the output projection', () => {
    const ops = ['list', 'findById', 'create', 'update', 'delete', 'output'];
    for (const op of ops) {
      expect(typeof SqlEntityOrm.prototype[op as keyof SqlEntityOrm]).toBe('function');
    }
  });
});
