import type { App } from './App.js';
import type { Extension } from './Extension.js';

/** Runs application extensions up in order and down in reverse order. */
export class AppLifecycle {
  private readonly members: Extension[] = [];

  add(...extensions: readonly (Extension | undefined)[]): this {
    for (const extension of extensions) {
      if (!extension) continue;
      const at = this.members.findIndex((held) => held.name === extension.name);
      if (at === -1) this.members.push(extension);
      else this.members[at] = extension;
    }

    return this;
  }

  names(): string[] {
    return this.members.map((extension) => extension.name);
  }

  async up(app: App): Promise<void> {
    for (const extension of this.members) await extension.up?.(app);
  }

  async down(app: App): Promise<void> {
    await closeAll(
      [...this.members].reverse().map((extension) => () => extension.down?.(app)),
      'extension(s) refused to release',
    );
  }
}

/**
 * Every level told to close even when one refuses, the refusals leaving together in one
 * `AggregateError` — one already carried by a level is flattened into the list.
 */
export async function closeAll(levels: readonly (() => unknown)[], refusals: string): Promise<void> {
  const refused: unknown[] = [];
  for (const level of levels) {
    try {
      await level();
    } catch (error) {
      if (error instanceof AggregateError) refused.push(...error.errors);
      else refused.push(error);
    }
  }

  if (refused.length > 0) throw new AggregateError(refused, `${refused.length} ${refusals}`);
}

/** The replaceable migration slot of the application lifecycle. */
export function migrating(
  migrate?: (app: App) => void | string | Promise<void | string>,
  report?: (message: string) => void,
): Extension {
  if (!migrate) return { name: 'migrate' };

  // What a pass DECLINED to change was thrown away at every call site — the same shape
  // `seeding` already has: the source knows what it found, the boot owns the voice.
  return {
    name: 'migrate',
    up: async (app: App) => {
      const said = await migrate(app);
      if (said) report?.(said);
    },
  };
}
