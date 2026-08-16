/**
 * Une clé de container est épelée à un seul endroit.
 *
 * Elles l'étaient à six : quatre fois `${…}Orm` dans `bootstrap.ts`, une cinquième
 * dans `scanner.ts` — où le SCAN dérive ce qu'un constructeur demande — et la
 * collector inline deux fois. Deux lecteurs d'une même convention, aucun des deux
 * ne la nommant : renommer en aurait déplacé un et laissé l'autre résoudre dans le
 * vide, au boot, sans que rien ne le dise.
 *
 * Ce test ne vérifie pas une chaîne de caractères — il vérifie que **ce que le
 * container contient répond à la clé que la fonction rend**. Une épellation qui
 * repart ailleurs le casse.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp } from '../src/index.js';
import { ormKeyOf } from '../src/orm.js';
import { facadeKeyOf } from '../src/wire/call.js';
import type { EntityOrm } from '../src/orm.js';

const root = join(import.meta.dirname, 'fixtures');

const fakeOrm = () => ({
  list: async () => [], findById: async () => undefined, findBy: async () => undefined,
  findAllBy: async () => [], create: async () => ({}), update: async () => ({}),
  delete: async () => true, output(this: unknown) { return this; },
}) as unknown as EntityOrm;

describe('les clés d\'enregistrement ont une seule orthographe', () => {
  it('ce que le boot enregistre répond à la clé que la fonction rend', async () => {
    await using app = await createApp({ root, createContainer, ormFactory: fakeOrm });

    for (const frond of app.fronds) {
      // L'ORM se lit par son accesseur, qui passe par le scope de la frond —
      // `ormFor` est la seule façon correcte de le demander de l'extérieur.
      for (const entity of frond.entities) {
        expect(app.ormFor(entity.name), `ormFor('${entity.name}')`).toBeDefined();
      }
      for (const handler of frond.handlers) {
        if (handler.surface) continue;
        expect(() => app.resolve(facadeKeyOf(handler.address)), handler.ctor.name).not.toThrow();
      }
    }
  });

  it('le scan demande la clé que le boot enregistre — même fonction des deux côtés', async () => {
    await using app = await createApp({ root, createContainer, ormFactory: fakeOrm });

    // `deps` vient de `depKeyOf` dans le scanner ; l'enregistrement vient de
    // `bootstrap`. Les deux lisent `ormKeyOf` maintenant, et c'est ce que dit ce test :
    // toute dépendance qui ressemble à une clé d'ORM est résoluble.
    const ormKeys = new Set(app.fronds.flatMap((f) => f.entities.map((e) => ormKeyOf(e.name))));
    const asked = app.fronds.flatMap((f) => [
      ...f.handlers.flatMap((h) => h.deps),
      ...f.presenters.flatMap((p) => p.deps),
    ]);

    for (const dep of asked.filter((d) => d.endsWith('Orm'))) {
      expect(ormKeys.has(dep), `${dep} demandé mais jamais enregistré`).toBe(true);
    }
  });
});
