/** What an app says about ITSELF — the `rpc.discover` answer, built from the app. */
import { Card } from '@fougere/schema';
import type { App } from './App.js';
import { factsAnnouncedBy } from '../wire/Emit.js';
import { type CardOp } from '../wire/card/CardOp.js';
import { type IdentityCard } from '../wire/card/IdentityCard.js';
import { facadeKeyOf } from '../wire/Facade.js';

type AnyFacade = Record<string, (...args: unknown[]) => Promise<unknown>>;

/** Serialize what the app hosts, for one audience. */
export function identityCardOf(app: App, surface?: string): IdentityCard {
  const declared = app.fronds.schemas();
  const entityNames = new Map<unknown, string>([
    ...[...declared].map(([name, schema]) => [schema, name] as const),
    ...app.fronds.flatMap((frond) => frond.entities.map((entity) => [entity.entityClass, entity.name] as const)),
  ]);

  return {
    fronds: app.fronds.filter((frond) => !frond.fromExtension).map((frond) => {
      const addresses = [...new Set(frond.handlers.map((handler) => handler.address))];

      const reached = new Set<string>();
      const facades = addresses.flatMap((address) => {
        const ops = facadeOps(app, address, entityNames, reached, surface);

        return ops.length === 0 ? [] : [{ name: address, ops }];
      });

      return {
        name: frond.name,
        entities: frond.entities.filter((entity) => reached.has(entity.name)).map((entity) => ({
          name: entity.name,
          schema: Card.fromSchema(entity.entityClass, entity.name).descriptor,
        })),
        facades,
        /** What leaves on its own — the same list on every surface, deliberately. */
        facts: factsAnnouncedBy(frond.handlers).map((name) => {
          const entityClass = declared.get(name);

          return { name, ...(entityClass ? { schema: Card.fromSchema(entityClass, name).descriptor } : {}) };
        }),
      };
    }),
  };
}

function facadeOps(
  app: App,
  address: string,
  entityNames: Map<unknown, string>,
  reached: Set<string>,
  surface?: string,
): CardOp[] {
  let facade: AnyFacade;
  try {
    facade = app.container.resolve<AnyFacade>(facadeKeyOf(address, surface));
  } catch {
    return [];
  }

  const effective = app.operationsFor(address, surface);
  if (!effective) {
    throw new Error(
      `Facade '${facadeKeyOf(address, surface)}' exists without an effective operation table. `
      + 'A facade and its table are built together, so no declaration can produce this.',
    );
  }

  return Object.keys(facade).map((name) => {
    const contract = effective.get(name);
    if (!contract) {
      throw new Error(
        `Facade '${facadeKeyOf(address, surface)}' serves '${name}' without an effective contract. `
        + 'A facade and its table are built together, so no declaration can produce this.',
      );
    }

    const listens = contract.binding.flatMap((bound) => (bound.source.kind === 'fact' ? [bound.source.factName] : []))[0];

    for (const view of [contract.input, contract.output]) {
      const entity = entityNames.get(view);
      if (entity) reached.add(entity);
    }

    return {
      name,
      ...(contract?.description && { description: contract.description }),
      ...(contract?.input && { input: Card.fromSchema(contract.input, entityNames.get(contract.input) ?? name).descriptor }),
      ...(contract?.output && { output: Card.fromSchema(contract.output, entityNames.get(contract.output) ?? name).descriptor }),
      ...(contract?.cardinality && { cardinality: contract.cardinality }),
      ...(contract.errors?.length ? { errors: contract.errors } : {}),
      ...(listens && { listens }),
      kind: contract.kind,
    };
  });
}
