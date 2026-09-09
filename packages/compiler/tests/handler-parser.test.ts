/**
 * The heritage clause, at the level of the parser that reads it.
 *
 * `crud-contract.test.ts` proves the ops reach the façade; this proves WHY, and pins the
 * one shape that broke it. `Crud` returns `asCrudConstructor(class CrudHandler { … })`,
 * so the class sits inside a call argument. A parser accepting only `return class { … }`
 * found nothing and said nothing — and because the scan cache keys on source rather than
 * on parser version, a warm cache kept serving the old, correct parse for weeks.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAllHandlerMethods } from '../src/scan/handler-parser.js';

/** A mixin file plus a handler extending it — the smallest thing the parser reads. */
function fixture(mixinBody: string): { dir: string; handler: string } {
  const dir = mkdtempSync(join(tmpdir(), 'fougere-parser-'));
  mkdirSync(join(dir, 'handlers'), { recursive: true });
  writeFileSync(join(dir, 'prefab.ts'), mixinBody);
  writeFileSync(
    join(dir, 'handlers', 'ThingHandler.ts'),
    `import { Prefab } from '../prefab.js';\nexport default class ThingHandler extends Prefab() {}\n`,
  );
  return { dir, handler: join(dir, 'handlers', 'ThingHandler.ts') };
}

const bare = `
export function Prefab() {
  return class PrefabBase {
    async list(): Promise<unknown[]> { return []; }
    async findById(id: string): Promise<unknown> { return id; }
  };
}
`;

const wrapped = `
function assertShape<T>(impl: object): T { return impl as T; }
export function Prefab() {
  return assertShape<unknown>(class PrefabBase {
    async list(): Promise<unknown[]> { return []; }
    async findById(id: string): Promise<unknown> { return id; }
  });
}
`;

const asserted = `
export function Prefab() {
  return (class PrefabBase {
    async list(): Promise<unknown[]> { return []; }
    async findById(id: string): Promise<unknown> { return id; }
  }) as unknown;
}
`;

describe('a handler inheriting from a mixin', () => {
  const opsOf = async (input: string) => {
    const { dir, handler } = fixture(input);
    try {
      // Heritage resolution is gated on a project root — without one the parser
      // reads the class alone and inherits nothing (workspace-only, by design).
      return (await parseAllHandlerMethods(handler, dir)).methods.map((m) => m.name).sort();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('finds the ops when the mixin returns the class bare', async () => {
    expect(await opsOf(bare)).toEqual(['findById', 'list']);
  });

  // The regression: this is the shape `Crud` actually has.
  it('finds them when a helper call stands between `return` and the class', async () => {
    expect(await opsOf(wrapped)).toEqual(['findById', 'list']);
  });

  it('finds them behind parentheses and an `as` assertion', async () => {
    expect(await opsOf(asserted)).toEqual(['findById', 'list']);
  });
});

describe('checked parameter types', () => {
  it('resolves a type alias and treats undefined as absence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fougere-checked-parser-'));
    const handler = join(dir, 'AccountHandler.ts');
    writeFileSync(join(dir, 'identity.ts'), `
      export class User { id!: string }
      export type CurrentUser = User | undefined;
    `);
    writeFileSync(handler, `
      import type { CurrentUser, User } from './identity.js';

      export default class AccountHandler {
        async concise(user?: User): Promise<User | undefined> { return user; }
        async aliased(user: CurrentUser): Promise<User | undefined> { return user; }
        async semantics(requiredNullable: string | null, optional?: string, optionalNullable?: string | null) {
          return { requiredNullable, optional, optionalNullable };
        }
      }
    `);

    try {
      const methods = (await parseAllHandlerMethods(handler)).methods;
      for (const name of ['concise', 'aliased']) {
        const method = methods.find((candidate) => candidate.name === name);
        expect(method?.params[0]).toMatchObject({
          name: 'user',
          type: { name: 'User' },
          optional: true,
        });
        expect(method?.returnType).toMatchObject({ name: 'User', undefined: true });
      }

      const semantics = methods.find((candidate) => candidate.name === 'semantics');
      expect(semantics?.params).toMatchObject([
        { name: 'requiredNullable', type: { name: 'string', nullable: true }, optional: false },
        { name: 'optional', type: { name: 'string' }, optional: true },
        { name: 'optionalNullable', type: { name: 'string', nullable: true }, optional: true },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
