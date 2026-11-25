import { describe, it, expect, afterAll } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { createAppRunner, Invocation } from '@fougere/core';
import { bootApp } from '@fougere/defaults';
import { bootApi } from '../apps/api/boot.js';
import { bootOps } from '../apps/ops/boot.js';

const root = join(import.meta.dirname, '..');
rmSync(join(root, '.data'), { recursive: true, force: true });

const api = await bootApi();
const ops = await bootOps();
const clock = await bootApp(root, { process: 'clock' });

afterAll(async () => {
  await ops.dispose();
  await api.dispose();
  await clock.dispose();
});

describe('two apps over the same fronds', () => {
  it('carries what apps.api states in apps/api, and platform: in apps/ops', () => {
    expect(api.extensions()).toEqual(expect.arrayContaining(['log', 'calls']));
    expect(ops.extensions()).toContain('log');
    expect(ops.extensions()).not.toContain('calls');
  });

  it('carries in the clock process the very list apps/api carries', () => {
    expect(clock.extensions()).toEqual(expect.arrayContaining(['log', 'calls']));
    expect(clock.fronds.filter((frond) => !frond.fromExtension).map((frond) => frond.name)).toEqual(['clock']);
  });

  it('shares the rows: what api writes, ops reads', async () => {
    await createAppRunner(api)({ address: 'note', op: 'create' }, { ...Invocation.empty, input: { title: 'one table' } });
    const listed = await createAppRunner(ops)({ address: 'note', op: 'list' }, Invocation.empty) as { items: { title: string }[] };

    expect(listed.items.map((note) => note.title)).toContain('one table');
  });
});
