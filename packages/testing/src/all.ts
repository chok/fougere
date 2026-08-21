import { describe, it, expect } from 'vitest';
import type { App } from '@fougere/core';
import type { SchemaView } from '@fougere/schema';
import { checkContract, checkOutput, type CheckOptions } from './doors.js';
import { checkDoors, type DoorOptions } from './comparison.js';

export interface CheckAllOptions extends DoorOptions, CheckOptions {
  /** Entities to leave out, by name — one whose rows a test cannot seed, typically. */
  except?: string[];
  /** Skip the four-door comparison. The contract and the leak are still checked. */
  doors?: boolean;
}

/**
 * Every entity the app SERVES, with its handler.
 *
 * Not every entity it scanned: one with no handler has no façade, so there is no door to
 * ask — the distinction the NOT_FOUND message used to miss. A relation is not followed
 * either; the entity it points at is checked on its own turn if it has a door.
 */
export function servedEntities(app: App): { name: string; entity: SchemaView }[] {
  const served: { name: string; entity: SchemaView }[] = [];
  for (const frond of app.fronds) {
    const addresses = new Set(frond.handlers.filter((handler) => !handler.surface).map((handler) => handler.address));
    for (const entity of frond.entities) {
      if (addresses.has(entity.name)) served.push({ name: entity.name, entity: entity.entityClass });
    }
  }
  return served;
}

/**
 * The whole suite, for every entity, from a file that names none of them.
 *
 * The list comes from the scan rather than from imports, and that is the point: a list of
 * imports is a second copy of what the project already declares, and it goes stale the day
 * an entity is added — silently, because a missing test cannot fail.
 *
 * An entity whose frond is declared in `remotes:` is not here at all: it is not this app's
 * to serve, and `testApp` does not follow the topology in the first place.
 */
export function checkAll(app: App, options: CheckAllOptions = {}): void {
  const except = new Set(options.except ?? []);
  const served = servedEntities(app).filter((one) => !except.has(one.name));

  describe('what this app serves', () => {
    it('is not empty — an empty suite proves nothing and still passes', () => {
      expect(served.length).toBeGreaterThan(0);
    });
  });

  for (const { entity } of served) {
    checkContract(app, entity, options);
    checkOutput(app, entity, options);
    if (options.doors !== false) checkDoors(app, entity, options);
  }
}
