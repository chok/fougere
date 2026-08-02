import { describe, expect, it, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { guardStorage } from '../src/egress.js';

/**
 * La règle « une clé inconnue est refusée » vaut aussi pour les arguments du framework.
 *
 * La façade refuse une clé inconnue dans l'entrée d'un client (`Unknown field`). Le port de
 * lecture, lui, ignorait la sienne : `list({ orderId })` était accepté, le critère jeté, et une
 * relation un-à-plusieurs répondait toute la table — la forme exacte du piège qu'on reproche
 * ailleurs, un cran au-dessus.
 */
class Line extends entity({ id: primary(), label: text() }) {}

function guardedOrm() {
  const list = vi.fn(async () => []);
  const orm = { list, create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) };
  return { orm, guarded: guardStorage(orm, Line.getFields(), 'line') };
}

describe('les options de lecture sont jugées', () => {
  it('refuse une option que le port ne lit pas', async () => {
    const { guarded } = guardedOrm();
    await expect(guarded.list({ order_id: 'x' } as never)).rejects.toThrow(/unknown option .*order_id/);
  });

  it('nomme le remède dans le message', async () => {
    const { guarded } = guardedOrm();
    await expect(guarded.list({ order_id: 'x' } as never)).rejects.toThrow(/where: \{ order_id/);
  });

  it('laisse passer les options connues', async () => {
    const { orm, guarded } = guardedOrm();
    await guarded.list({ limit: 10, orderBy: 'id', where: { label: 'a' } } as never);
    expect(orm.list).toHaveBeenCalled();
  });

  it('laisse passer un appel sans options', async () => {
    const { orm, guarded } = guardedOrm();
    await guarded.list();
    expect(orm.list).toHaveBeenCalled();
  });
});
