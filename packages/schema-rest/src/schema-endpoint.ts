/**
 * Registers GET /_fougere/schema — exposes each entity's portable descriptor
 * (the card) for `fougere sync`. The card is produced by @fougere/schema's single
 * canonical `describe()`, so the serialisation lives in one place (no hand-rolled copy).
 */
import type { HttpRouter } from '@fougere/http';
import { describe, type SchemaDescriptor, type SchemaLike } from '@fougere/schema';

interface EntityEntry {
  name: string;
  entityClass: SchemaLike;
  exposed?: boolean;
}

interface FrondLike {
  name: string;
  entities: EntityEntry[];
}

interface AppLike {
  fronds: FrondLike[];
}

export function registerSchemaEndpoint(router: HttpRouter, app: AppLike): void {
  router.on('GET', '/_fougere/schema', async () => {
    const fronds = app.fronds.map((frond) => ({
      frond: frond.name,
      entities: frond.entities.map((e): SchemaDescriptor => describe(e.entityClass, e.name)),
    }));

    return {
      status: 200,
      data: fronds,
    };
  });
}
