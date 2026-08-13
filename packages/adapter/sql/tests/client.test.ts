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

  it('échappe au juge du domaine, pas à celui du stockage', async () => {
    const { orm } = await app();
    const client = (orm as { client: any }).client;

    // `price_cents` déclare `min: 0`. Le port le refuse par `guardStorage` ; le client
    // ne rencontre pas ce juge-là — c'est le contrat de cette porte. Mais la borne est
    // aussi descendue dans le schéma, et la base ne fait de faveur à personne.
    await expect(
      client.insertInto('products').values({ id: 'x', name: 'A', price_cents: -100 }).execute(),
    ).rejects.toThrow(/CHECK/i);
  });

  it("reste la porte de ce que le port n'offre pas", async () => {
    const { orm } = await app();
    const client = (orm as { client: any }).client;
    await orm.create({ name: 'A', price_cents: 100 });
    await orm.create({ name: 'B', price_cents: 300 });

    // Une agrégation : aucune méthode du port ne la rend, et c'est pour ça que le
    // client se nomme au lieu de s'offrir.
    const { total } = await client
      .selectFrom('products')
      .select((eb: any) => eb.fn.sum('price_cents').as('total'))
      .executeTakeFirst();

    expect(Number(total)).toBe(400);
  });
});
