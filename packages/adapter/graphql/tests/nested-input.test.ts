import SchemaBuilder from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { entity, json, list, number, optional, text, writeOnly } from '@fougere/schema';
import { registerInput, registerType } from '../src/registerTypes.js';

/**
 * Une forme imbriquée EST un type, pas une chaîne.
 *
 * `list(json(OrderLine))` inline la shape de la ligne en `properties` — ce qui suffit au juge
 * mais restait invisible pour GraphQL : le cas `array` retombait sur `stringList`, `items`
 * arrivait en `[String!]!`, et un client devait encoder chaque ligne en JSON à la main. La
 * mutation était inutilisable.
 */
class OrderLine extends entity({
  product_id: text({ min: 1 }),
  quantity: number({ integer: true, min: 1 }),
}) {}

class CreateOrder extends entity({
  user_id: text({ min: 1 }),
  items: list(json(OrderLine), { min: 1 }),
}) {}

function build() {
  const builder = new SchemaBuilder({});
  builder.queryType({ fields: (t: any) => ({ ok: t.boolean({ resolve: () => true }) }) });
  registerInput(builder, { name: 'CreateOrderInput', schema: CreateOrder });

  return builder.toSchema();
}

const inputFieldsOf = (schema: any, name: string) =>
  (schema.getTypeMap()[name] as any)?.getFields?.() ?? {};

describe('une entrée qui porte des objets', () => {
  it("expose une liste d'objets, pas une liste de chaînes", () => {
    const items = inputFieldsOf(build(), 'CreateOrderInput').items;
    expect(String(items.type)).not.toContain('String');
    expect(String(items.type)).toContain('CreateOrderInputItemsItem');
  });

  it('le type imbriqué porte les champs de la forme, avec leurs scalaires', () => {
    const fields = inputFieldsOf(build(), 'CreateOrderInputItemsItem');
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['product_id', 'quantity']));
    expect(String(fields.quantity.type)).toContain('Int');
    expect(String(fields.product_id.type)).toContain('String');
  });

  it('un scalaire reste un scalaire', () => {
    expect(String(inputFieldsOf(build(), 'CreateOrderInput').user_id.type)).toContain('String');
  });
});

describe('un objet déclaré est un type, en entrée comme en sortie', () => {
  class Address extends entity({ city: text(), zip: number({ integer: true }) }) {}
  class Account extends entity({
    name: text(),
    secret: writeOnly(text()),
    address: json(Address),
    former: list(json(Address)),
  }) {}
  class Box extends entity({ account: json(Account), note: optional(json(Address)), loose: json() }) {}

  function schema() {
    const builder = new SchemaBuilder({});
    builder.queryType({ fields: (t: any) => ({ ok: t.boolean({ resolve: () => true }) }) });
    registerInput(builder, { name: 'BoxInput', schema: Box });
    registerType(builder, { name: 'BoxRow', entity: Box });

    return builder.toSchema();
  }

  it("l'entrée imbrique, à toute profondeur", () => {
    const built = schema();
    expect(String(inputFieldsOf(built, 'BoxInput').account.type)).toBe('BoxInputAccount!');
    expect(String(inputFieldsOf(built, 'BoxInput').note.type)).toBe('BoxInputNote');
    expect(String(inputFieldsOf(built, 'BoxInputAccount').address.type)).toBe('BoxInputAccountAddress!');
    expect(String(inputFieldsOf(built, 'BoxInputAccount').former.type)).toContain('BoxInputAccountFormerItem');
    expect(String(inputFieldsOf(built, 'BoxInputAccountAddress').zip.type)).toBe('Int!');
  });

  it('la sortie imbrique aussi, sans le champ writeOnly', () => {
    const built = schema();
    expect(String(inputFieldsOf(built, 'BoxRow').account.type)).toBe('BoxRowAccount!');
    expect(Object.keys(inputFieldsOf(built, 'BoxRowAccount')).sort()).toEqual(['address', 'former', 'name']);
    expect(String(inputFieldsOf(built, 'BoxRowAccount').address.type)).toBe('BoxRowAccountAddress!');
  });

  it('un json() sans entité reste une chaîne', () => {
    const built = schema();
    expect(String(inputFieldsOf(built, 'BoxInput').loose.type)).toContain('String');
    expect(String(inputFieldsOf(built, 'BoxRow').loose.type)).toContain('String');
  });
});
