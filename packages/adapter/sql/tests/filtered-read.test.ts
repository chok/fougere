import { beforeEach, describe, expect, it } from 'vitest';
import { entity, number, primary, ref, text } from '@fougere/schema';
import { migrate } from '../src/index.js';
import { setupSqlite } from '../src/sqlite.js';

/**
 * La lecture filtrée : ce que le storage sait faire, ce qu'il déclare, et ce qu'un appelant obtient.
 *
 * `findBy` lit UN enregistrement par critère. Son dual — « les plusieurs dont le champ vaut X »,
 * c'est-à-dire toute relation un-à-plusieurs — doit exister et être déclaré, sans quoi un
 * appelant qui passe un critère à `list()` se le fait jeter en silence.
 */
class Order extends entity({ id: primary(), label: text() }) {}
class Line extends entity({
  id: primary(),
  order_id: ref(Order),
  quantity: number({ integer: true, min: 1 }),
}) {}

async function seed() {
  const { db, storageFactory } = setupSqlite({ path: ':memory:' });
  const app = { fronds: [{ name: 'test', entities: [
    { name: 'order', entityClass: Order },
    { name: 'line', entityClass: Line },
  ] }] };
  await migrate(app as never, db);

  const orders = storageFactory(Order, 'order');
  const lines = storageFactory(Line, 'line');

  const a = await orders.create({ label: 'A' });
  const b = await orders.create({ label: 'B' });
  await lines.create({ order_id: a.id, quantity: 1 });
  await lines.create({ order_id: a.id, quantity: 2 });
  await lines.create({ order_id: b.id, quantity: 9 });

  return { orders, lines, a, b };
}

describe('lecture filtrée', () => {
  it('findBy rend un enregistrement par critère', async () => {
    const { lines, b } = await seed();
    const found = await (lines as never as { findBy(c: object): Promise<{ quantity: number }> })
      .findBy({ order_id: b.id });
    expect(found.quantity).toBe(9);
  });

  it('findAllBy rend TOUS les enregistrements du critère — le dual de findBy', async () => {
    const { lines, a } = await seed();
    const rows = await (lines as never as { findAllBy(c: object): Promise<unknown[]> }).findAllBy({ order_id: a.id });
    expect(rows).toHaveLength(2);
  });

  it("findAllBy ne rend rien pour un critère qui ne correspond à personne", async () => {
    const { lines } = await seed();
    const rows = await (lines as never as { findAllBy(c: object): Promise<unknown[]> })
      .findAllBy({ order_id: 'inexistant' });
    expect(rows).toHaveLength(0);
  });

  it('list() filtre sur `where`, et seulement là', async () => {
    const { lines, a } = await seed();
    const filtered = await lines.list({ where: { order_id: a.id } });
    expect(filtered).toHaveLength(2);
  });

  it("une clé inconnue posée à la racine des options reste ignorée", async () => {
    const { lines, a } = await seed();
    // Le critère se nomme (`where`) plutôt que de se répandre dans les options : sans quoi
    // une faute de frappe dans une option deviendrait un filtre, et une liste tronquée en
    // silence est pire qu'une option ignorée.
    const rows = await lines.list({ order_id: a.id } as never);
    expect(rows).toHaveLength(3);
  });
});

/**
 * Ce qu'une valeur et un ensemble ne pouvaient pas dire.
 *
 * `where` ne connaissait que l'égalité et l'appartenance, alors que presque tout ce qu'on
 * filtre en vrai est un intervalle. La seule sortie était `storage.client` — le chemin
 * sans juge et sans codecs.
 */
describe('un critère peut comparer', () => {
  it('borne par le bas', async () => {
    const { lines } = await seed();
    expect(await lines.list({ where: { quantity: { gte: 2 } } })).toHaveLength(2);
  });

  it('borne des deux côtés, et les deux bornes tiennent ensemble', async () => {
    const { lines } = await seed();
    expect(await lines.list({ where: { quantity: { gte: 2, lte: 2 } } })).toHaveLength(1);
  });

  it('nomme un intervalle', async () => {
    const { lines } = await seed();
    expect(await lines.list({ where: { quantity: { between: [1, 2] } } })).toHaveLength(2);
  });

  it('exclut', async () => {
    const { lines } = await seed();
    expect(await lines.list({ where: { quantity: { ne: 1 } } })).toHaveLength(2);
  });

  it('cherche dans le texte', async () => {
    const { orders } = await seed();
    expect(await orders.list({ where: { label: { contains: 'A' } } })).toHaveLength(1);
  });

  it('compte ce que la comparaison retient, pas ce que la table tient', async () => {
    const { lines } = await seed();
    const page = await lines.list({ where: { quantity: { gte: 2 } }, count: true });
    expect(page.total).toBe(2);
  });
});
