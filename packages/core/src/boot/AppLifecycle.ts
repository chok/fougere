import type { App } from './App.js';
import type { Extension } from './Extension.js';
import { StateShape } from '../wire/StateShape.js';
import { BootRefusal } from '../BootRefusal.js';
import { WITHOUT_GLOBAL_INSTALL } from '../command.js';

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

  /** Read off the members that stay, so an extension replaced by name declares nothing. */
  state(): StateShape {
    return StateShape.of(this.members);
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

/** Closes every level even when one refuses; the refusals leave together in one `AggregateError`. */
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

/**
 * The schema check every boot runs: the database is read against the entities, never written.
 *
 * Documented: [lifecycle](https://fougere.dev/docs/run/lifecycle).
 */
export function checking(pending?: (app: App) => Promise<readonly string[]>): Extension {
  if (!pending) return { name: 'schema' };

  return {
    name: 'schema',
    up: async (app: App) => {
      const behind = await pending(app);
      if (behind.length === 0) return;

      throw new BootRefusal(
        `Fougere boot refused: the database is missing ${behind.length} change(s) from the entities:\n`
        + behind.map((line) => `  ${line}`).join('\n')
        + '\n  On your machine: fougere migrate --latest --apply'
        + '\n  On a shared database: fougere freeze, then fougere migrate --apply'
        + `\n  ${WITHOUT_GLOBAL_INSTALL}`,
      );
    },
  };
}

/** The schema slot filled by a process that writes its own schema — its database is born with it. */
export function migrating(
  migrate?: (app: App) => void | string | Promise<void | string>,
  report?: (message: string) => void,
): Extension {
  if (!migrate) return { name: 'schema' };

  return {
    name: 'schema',
    up: async (app: App) => {
      const said = await migrate(app);
      if (said) report?.(said);
    },
  };
}
