/**
 * Letting an app go while work is still on it.
 *
 * `dispose()` closes a storage connection and every frond scope — which is what the
 * running calls are standing on. Nothing counted them, so "release it later" had no
 * later anything could name, and turning the ring under load truncated whatever was
 * mid-flight without a word.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, EMPTY_INVOCATION } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-drain');
const app = () => createApp({ root, createContainer });

describe('drain', () => {
  it('waits for a call that is already running', async () => {
    const a = await app();
    const call = createLocalRunner(a)({ entity: 'slow', op: 'work' }, EMPTY_INVOCATION);

    expect(a.inFlight()).toBe(1);
    await a.drain();

    expect(a.inFlight()).toBe(0);
    await expect(call).resolves.toEqual({ done: true });
    await a.dispose();
  });

  it('resolves at once when nothing is running', async () => {
    const a = await app();
    await a.drain();
    expect(a.inFlight()).toBe(0);
    await a.dispose();
  });

  it('refuses a call that arrives after the door closed', async () => {
    const a = await app();
    await a.drain();

    await expect(createLocalRunner(a)({ entity: 'slow', op: 'work' }, EMPTY_INVOCATION))
      .rejects.toThrow(/takes no new call/);
    await a.dispose();
  });

  it('rejects on its deadline naming what is left, rather than looking successful', async () => {
    const a = await app();
    void createLocalRunner(a)({ entity: 'slow', op: 'hang' }, EMPTY_INVOCATION).catch(() => {});

    await expect(a.drain(30)).rejects.toThrow(/1 call\(s\) still running after 30ms/);
    await a.dispose();
  });

  it('counts every door the same, and a call that throws still lets go', async () => {
    const a = await app();
    const door = a.facadeFor('slow')!;

    await expect(door.boom()).rejects.toThrow('nope');
    expect(a.inFlight()).toBe(0);

    await Promise.all([door.work(), door.work(), door.work()]);
    expect(a.inFlight()).toBe(0);
    await a.dispose();
  });
});
