import { describe, expect, it, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { StorageGuard } from '../src/dispatch/StorageGuard.js';
import type { ListOptions } from '../src/storage.js';

/**
 * La règle « une clé inconnue est refusée » vaut aussi pour les arguments du framework.
 *
 * La façade refuse une clé inconnue dans l'entrée d'un client (`Unknown field`). Le port de
 * lecture, lui, ignorait la sienne : `list({ orderId })` était accepté, le critère jeté, et une
 * relation un-à-plusieurs répondait toute la table — la forme exacte du piège qu'on reproche
 * ailleurs, un cran au-dessus.
 */
class Line extends entity({ id: primary(), label: text({ max: 5 }) }) {}

function guardedStorage() {
  // `list` déclare son paramètre : inspecter les options EST le travail du garde, et
  // `StorageGuard.guard` rend le type qu'on lui donne — un faux sans paramètre rendrait donc
  // les appels ci-dessous incompilables. `Record` ouvre la porte aux clés inconnues,
  // qui sont précisément ce que ces tests envoient.
  const list = vi.fn(async (_options?: ListOptions & Record<string, unknown>) => []);
  const storage = { list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) };
  return { storage, guarded: new StorageGuard(Line.getFields(), 'line').guard(storage) };
}

describe('les options de lecture sont jugées', () => {
  it('refuse une option que le port ne lit pas', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ order_id: 'x' })).rejects.toThrow(/unknown option .*order_id/);
  });

  it('nomme le remède dans le message', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ order_id: 'x' })).rejects.toThrow(/where: \{ order_id/);
  });

  it('laisse passer les options connues', async () => {
    const { storage, guarded } = guardedStorage();
    await guarded.list({ limit: 10, orderBy: 'id', where: { label: 'a' } });
    expect(storage.list).toHaveBeenCalled();
  });

  it('laisse passer un appel sans options', async () => {
    const { storage, guarded } = guardedStorage();
    await guarded.list();
    expect(storage.list).toHaveBeenCalled();
  });
});

describe('un filtre sur un champ que la porte ne rend pas', () => {
  it('le dit, sans refuser — c\'est légal aujourd\'hui', async () => {
    const said: string[] = [];
    const list = vi.fn(async (_o?: ListOptions & Record<string, unknown>) => []);
    const storage = { list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) };
    const guarded = new StorageGuard(Line.getFields(), 'line', {
      view: { id: Line.getFields().id },
      outOfView: (message) => said.push(message),
    }).guard(storage);

    await guarded.list({ where: { label: 'a' } });

    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/label/);
    expect(storage.list).toHaveBeenCalled();
  });

  it('le dit une fois, pas à chaque appel', async () => {
    const said: string[] = [];
    const list = vi.fn(async (_o?: ListOptions & Record<string, unknown>) => []);
    const guarded = new StorageGuard(Line.getFields(), 'line', {
      view: { id: Line.getFields().id },
      outOfView: (message) => said.push(message),
    }).guard({ list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) });

    await guarded.list({ where: { label: 'a' } });
    await guarded.list({ where: { label: 'b' } });

    expect(said).toHaveLength(1);
  });

  it('se tait sur un champ que la vue rend', async () => {
    const said: string[] = [];
    const list = vi.fn(async (_o?: ListOptions & Record<string, unknown>) => []);
    const guarded = new StorageGuard(Line.getFields(), 'line', {
      view: Line.getFields(),
      outOfView: (message) => said.push(message),
    }).guard({ list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) });

    await guarded.list({ where: { label: 'a' } });

    expect(said).toEqual([]);
  });
});

/**
 * Le contenu de `where` ne passait devant personne.
 *
 * Une écriture est jugée champ par champ ; une lecture ne l'était pas — et `params.filter`,
 * saisi dans un navigateur, arrive ici tel quel par la porte d'administration.
 */
describe('les critères sont jugés comme une écriture l\'est', () => {
  it('refuse un champ que l\'entité ne déclare pas', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ where: { jardin: 1 } })).rejects.toThrow(/jardin/);
  });

  it('refuse une valeur que le champ refuserait à l\'écriture', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ where: { label: 'bien trop long' } })).rejects.toThrow(/label/);
  });

  it('juge un ensemble membre par membre — c\'est ce que `IN` lie', async () => {
    const { storage, guarded } = guardedStorage();
    await guarded.list({ where: { label: ['a', 'b'] } });

    expect(storage.list).toHaveBeenCalledWith({ where: { label: ['a', 'b'] } });
  });

  it('refuse l\'ensemble dont un seul membre est refusé', async () => {
    const { guarded } = guardedStorage();
    await expect(guarded.list({ where: { label: ['a', 'bien trop long'] } })).rejects.toThrow(/label/);
  });
});
