import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
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
      const refused = (plan: Plan, replace = false) => refusalsOf(plan, catalog, { cwd, replace });
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

  it('starts one app at a time: dev for the first, dev:<name> for each', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'fougere-scripts-'));
    try {
      const writer = new ProjectWriter();
      const scripts = (dir: string) =>
        (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
      writer.createWorkspace(join(cwd, 'two'), 'two');
      writer.runApps(join(cwd, 'two'), ['web', 'ops']);
      expect(scripts(join(cwd, 'two'))).toMatchObject({
        dev: 'pnpm -C apps/web dev',
        'dev:web': 'pnpm -C apps/web dev',
        'dev:ops': 'pnpm -C apps/ops dev',
      });

      writer.createWorkspace(join(cwd, 'none'), 'none');
      writer.runApps(join(cwd, 'none'), []);
      expect(scripts(join(cwd, 'none'))).not.toHaveProperty('dev');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('replaces a project only once the new one is whole', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'fougere-replace-'));
    try {
      const dir = join(cwd, 'shop');
      const writer = new ProjectWriter();
      writer.write({ name: 'shop', fronds: [{ template: 'blog', name: 'blog' }], apps: [] }, dir);
      expect(() => writer.write({ name: 'shop', fronds: [], apps: [] }, dir)).toThrow('shop/ already exists.');

      const broken: Plan = { name: 'shop', fronds: [{ template: 'blank', name: 'core' }], apps: [{ template: 'nowhere', name: 'web' }] };
      expect(() => writer.write(broken, dir, { replace: true })).toThrow();
      expect(readdirSync(join(dir, 'fronds'))).toContain('blog');

      writer.write({ name: 'shop', fronds: [{ template: 'blank', name: 'core' }], apps: [] }, dir, { replace: true });
      expect(readdirSync(cwd)).toEqual(['shop']);
      expect(readdirSync(join(dir, 'fronds'))).not.toContain('blog');
      expect(readdirSync(join(dir, 'fronds'))).toContain('core');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe('the composer', () => {
  function screen(name = 'shop', taken: string[] = []) {
    const input = new PassThrough();
    const output = Object.assign(new PassThrough(), { columns: 100 });
    output.resume();
    const cwd = join(tmpdir(), 'fougere-nowhere');
    const composer = new Composer({
      name,
      catalog,
      exists: (candidate) => taken.includes(candidate),
      refusals: (plan, replace) => refusalsOf(plan, catalog, { cwd, replace }),
      input,
      output,
    });
    const answer = composer.ask();
    const press = (...keys: string[]) => { for (const key of keys) input.write(key); };

    return { composer, answer, press };
  }

  const DOWN = '\x1b[B';
  const LEFT = '\x1b[D';
  const ENTER = '\r';

  it('walks the three steps, and answers what they were left on', async () => {
    const { answer, press } = screen();
    press(ENTER);
    press(DOWN, ' ', '+', ...'\x7f'.repeat(6), ...'news', ENTER, ENTER);
    press(' ', ENTER);

    expect(await answer).toEqual({
      plan: {
        name: 'shop',
        fronds: [{ template: 'blog', name: 'blog' }, { template: 'blog', name: 'news' }],
        apps: [{ template: 'next', name: 'next' }],
      },
      overwrite: false,
    });
  });

  it('goes back a step, and keeps what was checked', async () => {
    const { answer, press } = screen();
    press(ENTER, ' ', ENTER, LEFT, LEFT, ...'\x7f'.repeat(4), ...'lab', ENTER, ENTER, ENTER);

    expect(await answer).toEqual({ plan: { name: 'lab', fronds: [{ template: 'blank', name: 'blank' }], apps: [] }, overwrite: false });
  });

  it('asks the name first, and does not move on without one', async () => {
    const { composer, answer, press } = screen('');
    press(ENTER);
    await new Promise((resolve) => setImmediate(resolve));
    expect(plain(composer.frame(100))).toContain('The project has no name');

    press(...'lab', ENTER, ENTER, ENTER);
    expect(await answer).toEqual({ plan: { name: 'lab', fronds: [], apps: [] }, overwrite: false });
  });

  it('offers to replace a project that already exists', async () => {
    const { composer, answer, press } = screen('shop', ['shop']);
    press(ENTER);
    await new Promise((resolve) => setImmediate(resolve));
    expect(plain(composer.frame(100))).toContain('shop/ already exists.');

    press('n', ...'\x7f'.repeat(4), ...'shop', ENTER, 'y', ENTER, ENTER);
    expect(await answer).toEqual({ plan: { name: 'shop', fronds: [], apps: [] }, overwrite: true });
  });

  it('answers nothing when cancelled', async () => {
    const { answer, press } = screen();
    press('\x03');

    expect(await answer).toBeUndefined();
  });

  it('shows the tree and the command beside every step', () => {
    const { composer, press } = screen();
    press(ENTER, DOWN, ' ');
    const frame = plain(composer.frame(100));

    expect(frame).toContain('✓ Project  ›  ● Fronds  ›  ○ Apps');
    expect(frame).toMatch(/◼ blog\s+├─ fougere\.config\.ts/);
    expect(frame).toContain('Same, with no prompt: pnpm create fougere shop --frond blog');
    expect(plain(composer.frame(40))).toMatch(/◼ blog\n/);
    press('\x03');
  });
});
