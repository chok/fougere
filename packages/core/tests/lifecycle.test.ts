/**
 * The ascent, named — and the three things that were only true by accident before it.
 *
 * `dispose` had a shape (reverse order, only what it built); the way up had four call sites
 * under one word, `afterBoot`, meaning two different things. A host that wanted its own
 * seeding had to claim EVERYTHING after the boot to get it, which is how the Nitro plugin's
 * copy of the seeding loop drifted out of sight.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { AppLifecycle, createApp, Lifecycle, migrating } from '../src/index.js';
import type { Extension } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-ports');

/** An extension that records when each half ran, in a shared list. */
const recording = (name: string, log: string[]): Extension => ({
  name,
  up: () => { log.push(`${name} up`); },
  down: () => { log.push(`${name} down`); },
});

describe('Lifecycle', () => {
  it('keeps Lifecycle as a compatibility alias', () => {
    expect(Lifecycle).toBe(AppLifecycle);
  });

  it('runs up in declaration order and down in reverse', async () => {
    const log: string[] = [];
    await using app = await createApp({
      scan: await scanProject(root), createContainer,
      extensions: [recording('migrate', log), recording('seeds', log)],
    });

    expect(log).toEqual(['migrate up', 'seeds up']);
    expect(app.extensions()).toEqual(['migrate', 'seeds']);

    await app.dispose();
    // Reverse of construction, the container's own rule read one level out.
    expect(log).toEqual(['migrate up', 'seeds up', 'seeds down', 'migrate down']);
  });

  /**
   * The one that lets a host say "the seeding, but mine" — Nuxt's plugin needs its seed
   * modules as static imports, and used to take over the whole post-boot to get them.
   */
  it('replaces a member of the same name, and keeps its position', async () => {
    const log: string[] = [];
    const lifecycle = new AppLifecycle()
      .add(recording('migrate', log), recording('seeds', log), recording('extra', log))
      .add({ name: 'seeds', up: () => { log.push('MY seeds'); } });

    expect(lifecycle.names()).toEqual(['migrate', 'seeds', 'extra']);
    await lifecycle.up({} as never);
    expect(log).toEqual(['migrate up', 'MY seeds', 'extra up']);
  });

  it('skips an absent member, so a host writes a conditional one inline', () => {
    expect(new AppLifecycle().add(undefined, migrating(() => {})).names()).toEqual(['migrate']);
  });

  /**
   * `migrating()` with nothing to run still HOLDS the slot. Returning `undefined` there is
   * what let a host's own `migrate` land after the seeds — the slot is what makes a later
   * declaration a replacement instead of an addition.
   */
  it('holds the migrate slot even when nothing migrates', async () => {
    const slot = migrating(undefined)!;
    expect(slot.name).toBe('migrate');
    expect(slot.up).toBeUndefined();
    await new AppLifecycle().add(slot).up({} as never);
  });

  /**
   * The asymmetry is the design: a half-started app must not be handed out, while a
   * half-released one has already leaked everything the first refusal skipped.
   */
  it('stops the ascent at the first refusal', async () => {
    const log: string[] = [];
    const lifecycle = new AppLifecycle().add(
      { name: 'migrate', up: () => { throw new Error('no such table'); } },
      recording('seeds', log),
    );

    await expect(lifecycle.up({} as never)).rejects.toThrow('no such table');
    // A seed that assumes a migration ran must not run when it did not.
    expect(log).toEqual([]);
  });

  /**
   * The rule `down` applies INSIDE its list, applied ACROSS the three levels of a release.
   * It was stated in one place and broken in the other: a refusing extension took the
   * container and the handed-in connection down with it, which is the leak this whole
   * gesture exists to prevent.
   */
  it('releases the container and what was handed in even when an extension refuses', async () => {
    const released: string[] = [];
    const container = createContainer();
    const disposeContainer = container.dispose.bind(container);
    container.dispose = async () => { released.push('container'); await disposeContainer(); };

    const app = await createApp({
      scan: await scanProject(root),
      createContainer: () => container,
      extensions: [{ name: 'broken', down: () => { throw new Error('socket already gone'); } }],
      onDispose: () => { released.push('handed in'); },
    });

    await expect(app.dispose()).rejects.toThrow(AggregateError);
    // Still told to close, both of them — and the refusal is still reported.
    expect(released).toEqual(['container', 'handed in']);
  });

  /**
   * The caller hands `onDispose` over BEFORE the ascent runs, and never receives the app that
   * would carry it back. So a refusal on the way up has to release what the boot took, or
   * whoever opened the connection leaks it on every failed boot.
   */
  it('releases what it took when the ascent refuses', async () => {
    const released: string[] = [];
    const container = createContainer();
    const disposeContainer = container.dispose.bind(container);
    container.dispose = async () => { released.push('container'); await disposeContainer(); };

    const boot = createApp({
      scan: await scanProject(root),
      createContainer: () => container,
      extensions: [
        { name: 'opens', down: () => { released.push('opens'); } },
        { name: 'refuses', up: () => { throw new Error('port 5432 refused'); } },
      ],
      onDispose: () => { released.push('handed in'); },
    });

    await expect(boot).rejects.toThrow('port 5432 refused');
    expect(released).toEqual(['opens', 'container', 'handed in']);
  });

  it('keeps the original refusal beside the ones raised while releasing', async () => {
    const boot = createApp({
      scan: await scanProject(root),
      createContainer,
      extensions: [{ name: 'refuses', up: () => { throw new Error('up refused'); } }],
      onDispose: () => { throw new Error('close refused'); },
    });

    await expect(boot).rejects.toMatchObject({
      errors: [expect.objectContaining({ message: 'up refused' }), expect.objectContaining({ message: 'close refused' })],
    });
  });

  /**
   * The order that was broken in production shape: a host declares its own `migrate` AFTER
   * the framework's defaults, and rows must still land after tables.
   */
  it('keeps migrate before seeds when the host declares its own migrate last', async () => {
    const ran: string[] = [];
    await using app = await createApp({
      scan: await scanProject(root), createContainer,
      extensions: [
        // No local storage resolved, so the framework contributes an empty slot…
        migrating(undefined),
        { name: 'seeds', up: () => { ran.push('seeds'); } },
        // …and the host fills it here, which must not land after the seeds.
        migrating(() => { ran.push('migrate'); }),
      ],
    });

    expect(app.extensions()).toEqual(['migrate', 'seeds']);
    expect(ran).toEqual(['migrate', 'seeds']);
  });

  it('releases every member even when one refuses, and reports them together', async () => {
    const log: string[] = [];
    const lifecycle = new AppLifecycle().add(
      recording('first', log),
      { name: 'broken', down: () => { throw new Error('socket already gone'); } },
      recording('last', log),
    );

    await expect(lifecycle.down({} as never)).rejects.toThrow(AggregateError);
    // 'first' is what the abandoned release used to leak.
    expect(log).toEqual(['last down', 'first down']);
  });
});
