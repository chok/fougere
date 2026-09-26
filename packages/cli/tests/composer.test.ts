import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { stripVTControlCharacters as plain } from 'node:util';
import ProjectWriter from '../fronds/scaffold/services/ProjectWriter.js';
import { Composer } from '../src/composer/Composer.js';
import { type Plan, commandOf, planOf, refusalsOf, treeOf } from '../src/composer/Plan.js';

const catalog = { fronds: ['blank', 'blog'], apps: ['next', 'nuxt'] };

/** `pnpm create fougere shop --frond blog --app nuxt`, read back as the flags citty would hand over. */
function reread(command: string): Plan | undefined {
  const [, , , name, ...rest] = command.split(' ');
  const flags: Record<string, string | boolean> = {};
  for (let at = 0; at < rest.length; at++) {
    if (rest[at] === '--bare') flags.bare = true;
    else flags[rest[at].slice(2)] = rest[++at];
  }

  return planOf({ name, ...flags });
}

describe('a plan', () => {
  it('is what the flags state, and the command it prints states it again', () => {
    const plans: Plan[] = [
      { name: 'shop', fronds: [{ template: 'blog', name: 'blog' }], apps: [{ template: 'nuxt', name: 'nuxt' }] },
      { name: 'shop', fronds: [{ template: 'blog', name: 'blog' }, { template: 'blog', name: 'news' }], apps: [{ template: 'nuxt', name: 'web' }] },
      { name: 'shop', fronds: [], apps: [] },
    ];

    for (const plan of plans) expect(reread(commandOf(plan))).toEqual(plan);
    expect(commandOf(plans[2])).toBe('pnpm create fougere shop --bare');
  });

  it('leaves the asking to the composer when the flags compose nothing', () => {
    expect(planOf({ name: 'shop' })).toBeUndefined();
  });

  it('refuses a piece with two names', () => {
    expect(() => planOf({ name: 'shop', frond: 'blog:news:old' })).toThrow("one colon at most");
  });

  it('names what stops it, before anything is written', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'fougere-plan-'));
    try {
      const refused = (plan: Plan, force = false) => refusalsOf(plan, catalog, { cwd, force });
      expect(refused({ name: '', fronds: [], apps: [] })).toEqual(['The project has no name — fougere new <name>.']);
      expect(refused({ name: 'Shop', fronds: [], apps: [] })[0]).toContain('is not a package name');
      expect(refused({ name: 'tmp', fronds: [{ template: 'shop', name: 'shop' }], apps: [] })[0]).toContain("No fronds template 'shop'");
      expect(refused({ name: 'tmp', fronds: [{ template: 'blog', name: 'blog' }, { template: 'blank', name: 'blog' }], apps: [] }))
        .toEqual(["Two fronds are called 'blog' — rename one."]);

      rmSync(join(cwd, 'taken'), { recursive: true, force: true });
      new ProjectWriter().createWorkspace(join(cwd, 'taken'), 'taken');
      expect(refused({ name: 'taken', fronds: [], apps: [] })[0]).toContain('taken/ already exists');
      expect(refused({ name: 'taken', fronds: [], apps: [] }, true)).toEqual([]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('draws the directories it writes', () => {
    expect(treeOf({ name: 'shop', fronds: [{ template: 'blog', name: 'blog' }], apps: [{ template: 'nuxt', name: 'web' }] })).toEqual([
      'shop/',
      '├─ fougere.config.ts',
      '├─ package.json',
      '├─ fronds/',
      '│  └─ blog/',
      '└─ apps/',
      '   └─ web/',
    ]);
  });
});

describe('the writer', () => {
  it('writes the whole plan or nothing', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'fougere-write-'));
    try {
      const plan: Plan = { name: 'shop', fronds: [{ template: 'blog', name: 'blog' }], apps: [{ template: 'nowhere', name: 'web' }] };
      expect(() => new ProjectWriter().write(plan, join(cwd, 'shop'))).toThrow("No host ships a starter for 'nowhere'");
      expect(readdirSync(cwd)).toEqual([]);

      new ProjectWriter().write({ ...plan, apps: [] }, join(cwd, 'shop'));
      expect(readdirSync(cwd)).toEqual(['shop']);
      expect(existsSync(join(cwd, 'shop', 'fronds', 'blog', 'package.json'))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe('the composer', () => {
  function screen(name = 'shop') {
    const input = new PassThrough();
    const output = Object.assign(new PassThrough(), { columns: 100 });
    output.resume();
    const composer = new Composer(name, catalog, (plan) => refusalsOf(plan, catalog, { cwd: tmpdir() + '/nowhere' }), { input, output });
    const answer = composer.ask();
    const press = (...keys: string[]) => { for (const key of keys) input.write(key); };

    return { composer, answer, press };
  }

  const DOWN = '\x1b[B';

  it('answers the plan the screen was left on — checked, duplicated, renamed', async () => {
    const { answer, press } = screen();
    press(DOWN, DOWN, ' ', '+', '\x7f', '\x7f', '\x7f', '\x7f', '\x7f', '\x7f', 'n', 'e', 'w', 's', '\r', DOWN, ' ', '\r', '\r');

    expect(await answer).toEqual({
      name: 'shop',
      fronds: [{ template: 'blog', name: 'blog' }, { template: 'blog', name: 'news' }],
      apps: [{ template: 'next', name: 'next' }],
    });
  });

  it('asks the name first when none was given, and refuses to leave without one', async () => {
    const { composer, answer, press } = screen('');
    press('\r', '\r');
    await new Promise((resolve) => setImmediate(resolve));
    expect(plain(composer.frame(100))).toContain('The project has no name');

    press('r', 'l', 'a', 'b', '\r', '\r');
    expect(await answer).toEqual({ name: 'lab', fronds: [], apps: [] });
  });

  it('answers nothing when cancelled', async () => {
    const { answer, press } = screen();
    press('\x03');

    expect(await answer).toBeUndefined();
  });

  it('shows the tree and the command beside the choices', () => {
    const { composer, press } = screen();
    press(DOWN, DOWN, ' ');
    const frame = plain(composer.frame(100));

    expect(frame).toMatch(/◼ blog\s+└─ blog\//);
    expect(frame).toContain('Same, with no prompt: pnpm create fougere shop --frond blog');
    expect(plain(composer.frame(40))).toMatch(/◼ blog\n/);
    press('\x03');
  });
});
