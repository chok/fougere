import SchemaBuilder from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { entity, number, primary, ref, text } from '@fougere/schema';
import { registerAll } from '../src/auto-register.js';

/**
 * Un presenter et une relation peuvent nommer le même champ.
 *
 * `Order.user_id` est un `ref(User)` : la projection en dérive un champ de relation. Si le
 * presenter déclare lui aussi `user`, deux producteurs visent un même nom — et c'est
 * l'auteur qui doit gagner, puisque son presenter est explicite.
 */
class User extends entity({ id: primary(), name: text() }) {}
class Order extends entity({ id: primary(), user_id: ref(User), label: text() }) {}
class Line extends entity({ id: primary(), order_id: ref(Order), quantity: number({ integer: true }) }) {}

/** La vue qu'un champ calculé émet — dérivée d'une entité, jamais écrite à la main. */
class LineView extends entity({ id: primary(), quantity: number({ integer: true }) }) {}

function fakeApp(presenterFields: string[], views?: Record<string, any>) {
  const facade = {
    list: async () => [],
    findById: async () => undefined,
  };
  return {
    fronds: [{
      name: 'orders',
      entities: [
        { name: 'user', entityClass: User },
        { name: 'order', entityClass: Order },
        { name: 'line', entityClass: Line },
      ],
      handlers: [
        { entityName: 'user', operations: new Map() },
        { entityName: 'order', operations: new Map() },
        { entityName: 'line', operations: new Map() },
      ],
      presenters: [{ entityName: 'order', fields: presenterFields, views }],
    }],
    // Une instance de classe, comme le vrai presenter : les méthodes sont sur le prototype,
    // et les dépendances injectées sont les seules propriétés propres.
    resolve: () => new (class {
      itemOrm = { list: async () => [] };
      async user() { return { id: '1', name: 'depuis le presenter' }; }
      async items() { return []; }
      async total_cents() { return 0; }
    })(),
    facadeFor: () => facade,
  } as never;
}

function build(presenterFields: string[], views?: Record<string, any>) {
  const builder = new SchemaBuilder({});
  builder.queryType({});
  builder.mutationType({});
  registerAll(builder, fakeApp(presenterFields, views));
  return builder.toSchema();
}

const fieldsOf = (schema: any, typeName: string) =>
  (schema.getTypeMap()[typeName] as any)?.getFields?.() ?? {};

describe('presenter et relation sur un même nom', () => {
  it('construit un schéma quand le presenter ne recoupe rien', () => {
    const schema = build(['items', 'total_cents']);
    expect(schema.getTypeMap()['Order']).toBeDefined();
  });

  it('construit un schéma quand le presenter nomme aussi une relation', () => {
    // Sans garde, Pothos refuse le second producteur du champ et fait tomber tout le schéma —
    // l'app ne démarre plus, et la seule issue visible est de supprimer le presenter (donc de
    // casser la surface REST qui en dépend).
    const schema = build(['user', 'items', 'total_cents']);
    expect(schema.getTypeMap()['Order']).toBeDefined();
  });

  it("le champ contesté existe et vient du presenter", () => {
    const schema = build(['user', 'items', 'total_cents']);
    const fields = (schema.getTypeMap()['Order'] as never as { getFields(): Record<string, unknown> }).getFields();
    expect(Object.keys(fields)).toContain('user');
  });

  it('les champs calculés du presenter arrivent dans le type', () => {
    // Un presenter est une INSTANCE : ses méthodes vivent sur le prototype. Les énumérer
    // avec `Object.entries` ne rendait que les champs du constructeur (les ORM injectés),
    // donc aucun champ calculé n'atteignait le schéma — une commande GraphQL sortait sans
    // son client, ses lignes ni son total, quand REST les portait tous les trois.
    const schema = build(['user', 'items', 'total_cents']);
    const fields = (schema.getTypeMap()['Order'] as never as { getFields(): Record<string, unknown> }).getFields();
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['user', 'items', 'total_cents']));
  });

  it("n'expose pas les dépendances injectées du presenter", () => {
    const schema = build(['user', 'items', 'total_cents']);
    const fields = (schema.getTypeMap()['Order'] as never as { getFields(): Record<string, unknown> }).getFields();
    expect(Object.keys(fields)).not.toContain('itemOrm');
  });
});

describe('un champ calculé qui déclare sa vue', () => {
  it("rend un type d'objet interrogeable, pas une chaîne", () => {
    // Sans déclaration, la projection ne peut que sérialiser : un client demandant
    // `items { quantity }` reçoit « Field items must not have a selection since type
    // String has no subfields » sur un champ que REST servait entier.
    const schema = build(['items'], { items: [LineView] });
    const items = fieldsOf(schema, 'Order').items;
    expect(String(items.type)).toContain('OrderItems');
    expect(Object.keys(fieldsOf(schema, 'OrderItems'))).toEqual(
      expect.arrayContaining(['id', 'quantity']),
    );
  });

  it('un champ non déclaré reste sérialisé — la déclaration est facultative', () => {
    const schema = build(['items']);
    expect(String(fieldsOf(schema, 'Order').items.type)).toBe('String');
  });
});
