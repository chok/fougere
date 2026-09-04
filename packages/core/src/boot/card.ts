/** What an app says about ITSELF — the `rpc.discover` answer, built from the app. */
import { Card } from '@fougere/schema';
import type { App } from './types.js';
import { factsAnnouncedBy } from '../emit.js';
import type { InvocationContext } from '../contract/Invocation.js';
import { facadeKeyOf, contractsKeyOf, type CardOp, type IdentityCard } from '../wire/call.js';
import type { OperationContract } from '../wire/operation.js';

type AnyFacade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

/** Serialize what the app hosts, for one audience. */
export function identityCardOf(app: App, surface?: string): IdentityCard {
  const declared = app.fronds.schemas();

  return {
    fronds: app.fronds.map((frond) => {
      // What the frond answers to, not what it stores. This walked `frond.entities`, so a
      // handler carrying no entity — a health check, a search across shapes — was built,
      // served, and absent from the card: `sync` could not generate its door and a remote
      // consumer had no way to know it existed. The boot has said "pointing at nothing is
      // legal" since handlers became the subject; the card had not caught up.
      const byEntity = new Map(frond.entities.map((entity) => [entity.name, entity]));
      const addresses = [...new Set([
        ...frond.entities.map((entity) => entity.name),
        ...frond.handlers.map((handler) => handler.address),
      ])];

      return {
        name: frond.name,
        doors: addresses.flatMap((address) => {
          const ops = facadeOps(app, address, surface);
          if (ops.length === 0) return [];
          const entity = byEntity.get(address);
          return [{
            name: address,
            ops,
            // Absent when nothing of that name is stored. A door is still a door.
            ...(entity ? { schema: Card.fromSchema(entity.entityClass, address).descriptor } : {}),
          }];
        }),
        /** What leaves on its own — the same list on every surface, deliberately. */
        facts: factsAnnouncedBy(frond.handlers).map((name) => {
          const entityClass = declared.get(name);
          return { name, ...(entityClass ? { schema: Card.fromSchema(entityClass, name).descriptor } : {}) };
        }),
      };
    }),
  };
}

function facadeOps(app: App, entityName: string, surface?: string): CardOp[] {
  let facade: AnyFacade;
  try {
    facade = app.container.resolve<AnyFacade>(facadeKeyOf(entityName, surface));
  } catch {
    return [];
  }

  // The façade is the list of names; the model is the resolved terms.
  const effective = app.operationsFor(entityName, surface);
  if (!effective) {
    throw new Error(
      `Facade '${facadeKeyOf(entityName, surface)}' exists without an effective operation table.`,
    );
  }

  return Object.keys(facade).map((name) => {
    const contract = effective.get(name);
    if (!contract) {
      throw new Error(
        `Facade '${facadeKeyOf(entityName, surface)}' serves '${name}' without an effective contract.`,
      );
    }

    return {
      name,
      ...(contract?.description && { description: contract.description }),
      ...(contract?.input && { input: Card.fromSchema(contract.input, name).descriptor }),
      ...(contract?.output && { output: Card.fromSchema(contract.output, name).descriptor }),
      ...(contract?.cardinality && { cardinality: contract.cardinality }),
      kind: contract.kind,
    };
  });
}
