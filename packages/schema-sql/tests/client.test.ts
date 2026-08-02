import { describe, expect, it } from 'vitest';
import { entity, number, primary, text } from '@fougere/schema';
import { migrate } from '../src/index.js';
import { setupSqlite } from '../src/setup.js';

/**
 * `orm.client` — ce que l'ORM enveloppe, nommé sur l'ORM plutôt que posé à côté.
 *
 * Le passe-droit existe : une requête écrite là ne rencontre aucun juge. Ce qui change,
 * c'est qu'on l'atteint par le port de l'entité, donc en gardant le scope que le conteneur
 * a donné — et non par une instance globale offerte au premier rang de la composition, où
 * elle se lisait comme la porte ordinaire.
 */
class Product extends entity({ id: primary(), name: text(), price_cents: number({ integer: true, min: 0 }) }) {}

async function app() {
  const setup = setupSqlite({ path: ':memory:' });
  const fake = { fronds: [{ name: 'shop', entities: [{ name: 'product', entityClass: Product }] }] };
  // `migrate` prend le setup : le cas normal n'a plus besoin d'atteindre l'instance brute.
  await migrate(fake as never, setup);
  return { setup, orm: setup.ormFactory(Product, 'product') };
}

describe('orm.client', () => {
  it("rend le client que l'ORM enveloppe", async () => {
    const { orm } = await app();
    expect((orm as { client?: unknown }).client).toBeDefined();
  });

  it('atteint les mêmes lignes que le port', async () => {
    const { orm } = await app();
    await orm.create({ name: 'Clavier', price_cents: 4990 });

    const client = (orm as { client: any }).client;
    const rows = await client.selectFrom('products').selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Clavier');
  });

  it('ne rencontre aucun juge — le prix de la porte', async () => {
    const { orm } = await app();
    const client = (orm as { client: any }).client;

    // `price_cents` déclare `min: 0`. Par le port, `guardStorage` le refuse ; par le client,
    // la valeur entre. C'est le contrat de cette porte, et la raison pour laquelle elle se
    // nomme au lieu de s'offrir.
    await client.insertInto('products').values({ id: 'x', name: 'A', price_cents: -100 }).execute();
    const row = await client.selectFrom('products').selectAll().executeTakeFirst();
    expect(row.price_cents).toBe(-100);
  });
});
