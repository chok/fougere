import type { App } from '@fougere/core';
import type { EntityEntry, HandlerEntry } from '@fougere/core/descriptor';

/** One command of this CLI: an entity whose handler answers `execute`. */
export interface CliCommand {
  name: string;
  entity: EntityEntry;
  handler: HandlerEntry;
}

/** Every command of an app, as the runner serves them and the shell completes them. */
export function cliCommandsOf(app: App): CliCommand[] {
  return app.fronds.flatMap((frond) => {
    const handlers = new Map(frond.handlers.map((handler) => [handler.address, handler]));

    return frond.entities.flatMap((entity) => {
      const handler = handlers.get(entity.name);
      if (!handler || typeof app.facadeFor(entity.name)?.execute !== 'function') return [];

      return [{ name: kebabOf(entity.name), entity, handler }];
    });
  });
}

/** A name as a command writes it.
 * Ex: `buildFrond` → `build-frond`. */
export function kebabOf(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^-/, '');
}
