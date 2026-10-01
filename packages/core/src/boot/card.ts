/** What an app says about ITSELF — the `rpc.discover` answer, built from the app. */
import { Card } from '@fougere/schema';
import type { App } from './App.js';
import { factsAnnouncedBy } from '../wire/Emit.js';
import type { InvocationContext } from '../wire/InvocationContext.js';
import { type CardOp } from '../wire/card/CardOp.js';
import { type IdentityCard } from '../wire/card/IdentityCard.js';
import { facadeKeyOf } from '../wire/Facade.js';

type AnyFacade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

/** Serialize what the app hosts, for one audience. */
export function identityCardOf(app: App, surface?: string): IdentityCard {
  const declared = app.fronds.schemas();
  // An op's output that IS an entity travels under the entity's name, so a reader of the card
  // ties it to that entity instead of guessing from the address.
  const entityNames = new Map([...declared].map(([name, schema]) => [schema, name]));

  return {
    // What this app SERVES, never what instruments it. A frond an extension BROUGHT is a
    // subscriber — `@fougere/calls` and `@fougere/observability` each bring one — and it is
    // in every process that installed the extension, so two remotes then claimed the same
    // facade and routing refused: `Two remotes serve 'export'`. `FrondDescriptor.brought` is
    // the mark `calls`' panel and `rpc.topology` already read.
    fronds: app.fronds.filter((frond) => !frond.brought).map((frond) => {
      // What the frond answers to, and apart from it what it stores: an address is where a
      // call goes, an entity is the shape of a row, and a handler may carry none.
      const addresses = [...new Set(frond.handlers.map((handler) => handler.address))];

      // An entity no served op takes or answers stays off the card: publishing it would give
      // away the shape of a table nobody can reach — the auth tables, typically.
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

  // The façade is the list of names; the model is the resolved terms.
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
