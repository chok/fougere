/**
 * Ce qu'une passe additive laisse derrière elle, dit au boot.
 *
 * La migration crée ce qui manque et ne touche jamais une colonne qui existe — une
 * promesse à tenir, et un silence à rompre : relâcher un champ `required` laisse à la
 * table son NOT NULL, et l'écriture échoue sur une ligne, en production, longtemps après
 * le boot qui aurait pu la nommer. Mesuré sur un vrai projet, deux fois.
 */
import { describe, expect, it } from 'vitest';
import { entity, number, optional, primary, text } from '@fougere/schema';

import { desiredTables, drift, migrate } from '../src/index.js';
import { setupSqlite } from '../src/sqlite.js';

const viewOf = (entityClass: unknown, name: string) => ({
  fronds: [{ name: 'test', entities: [{ name, entityClass }] }],
});

/** Une base née d'une déclaration, puis relue contre une autre. */
async function moved(before: unknown, after: unknown) {
  const { db } = setupSqlite({ path: ':memory:' });
  await migrate(viewOf(before, 'row') as never, db);

  return drift(db, desiredTables(viewOf(after, 'row') as never));
}

describe('une déclaration qui a bougé sans sa table', () => {
  it('nomme un champ devenu optionnel dont la table garde son NOT NULL', async () => {
    class Was extends entity({ id: primary(), label: text() }) {}
    class Now extends entity({ id: primary(), label: optional(text()) }) {}

    const found = await moved(Was, Now);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ table: 'rows', column: 'label', declared: 'optional', held: 'NOT NULL' });
  });

  it('nomme un champ devenu requis que la table accepte encore vide', async () => {
    class Was extends entity({ id: primary(), count: optional(number()) }) {}
    class Now extends entity({ id: primary(), count: number() }) {}

    const found = await moved(Was, Now);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ declared: 'required', held: 'nullable' });
  });

  it('se tait quand les deux disent la même chose', async () => {
    class Row extends entity({ id: primary(), label: text(), count: optional(number()) }) {}

    expect(await moved(Row, Row)).toEqual([]);
  });

  it('se tait sur une colonne que la passe additive va créer', async () => {
    class Was extends entity({ id: primary() }) {}
    class Now extends entity({ id: primary(), label: optional(text()) }) {}

    // Elle n'existe pas encore : c'est l'affaire de `delta`, pas de celle-ci.
    expect(await moved(Was, Now)).toEqual([]);
  });
});
