import type { App } from './types.js';

/** One process-level extension and its reversible lifecycle. */
export interface Extension {
  name: string;
  up?(app: App): void | Promise<void>;
  down?(app: App): void | Promise<void>;
}

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
    const refused: unknown[] = [];
    for (const extension of [...this.members].reverse()) {
      try {
        await extension.down?.(app);
      } catch (error) {
        refused.push(error);
      }
    }
    if (refused.length > 0) {
      throw new AggregateError(refused, `${refused.length} extension(s) refused to release`);
    }
  }
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
