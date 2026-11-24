import type { App } from '@fougere/core';
import type { EntityEntry, HandlerEntry } from '@fougere/core/descriptor';
import { positionalOf } from '@fougere/oclif/positional';

/** One command of this CLI: an entity whose handler answers `execute`. */
export interface CliCommand {
  name: string;
  entity: EntityEntry;
  handler: HandlerEntry;
  /** The parameters `frond.config.ts` gives by position; absent, the first required text is. */
  positional?: readonly string[];
}

/** Every command of an app, as the runner serves them and the shell completes them. */
export function cliCommandsOf(app: App): CliCommand[] {
  return app.fronds.flatMap((frond) => {
    const handlers = new Map(frond.handlers.map((handler) => [handler.address, handler]));

    return frond.entities.flatMap((entity) => {
      const handler = handlers.get(entity.name);
      if (!handler || typeof app.facadeFor(entity.name)?.execute !== 'function') return [];

      const positional = positionalOf(frond, handler.address, 'execute');

      return [{ name: kebabOf(entity.name), entity, handler, ...(positional ? { positional } : {}) }];
    });
  });
}

/** A name as a command writes it.
 * Ex: `buildFrond` → `build-frond`. */
export function kebabOf(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^-/, '');
}
