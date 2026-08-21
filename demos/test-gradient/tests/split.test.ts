/**
 * CRAN 3 — l'app dans son process, le test en client.
 *
 * Rien de neuf n'est inventé ici : le test parle par le transport qui fait déjà marcher
 * un frond déplacé. C'est le gradient appliqué au test lui-même — il devient un
 * consommateur, exactement comme un navigateur posé à côté.
 *
 * Playwright n'a pas d'objet dans cette démo : elle n'a pas de front. Le cran navigateur
 * se montre là où il y a des pages.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createLocalRunner, type App } from '@fougere/core';
import { serve, createHttpTransport, type RunningReceiver } from '@fougere/transport-http';
import { testApp, sampleInput } from '@fougere/testing';
import Product from '../fronds/catalog/entities/Product.js';

let app: App;
let receiver: RunningReceiver;
let call: ReturnType<typeof createHttpTransport>;

beforeAll(async () => {
  app = await testApp({ root: import.meta.dirname.replace(/\/tests$/, '') });
  // Port 0 : le système en choisit un libre, donc deux runs en parallèle ne se marchent
  // pas dessus — la même raison qui fait qu'une base de test est jetable par run.
  receiver = await serve(createLocalRunner(app), { port: 0 });
  // L'adresse de base, comme `remotes: { blog: 'http://127.0.0.1:4100' }` — le
  // transport connaît son propre chemin.
  call = createHttpTransport(`http://127.0.0.1:${receiver.port}`);
});

afterAll(async () => {
  await receiver.close();
  await app.dispose();
});

describe('une app derrière sa porte', () => {
  it('accepte une ligne semée par le fil', async () => {
    const created = await call(
      { entity: 'product', op: 'create' },
      { params: {}, query: {}, body: sampleInput(Product, { sku: 'WIRE-1' }), state: {} },
    ) as { sku: string; id: string };

    expect(created.sku).toBe('WIRE-1');
    expect(created.id).toBeTruthy();
  });

  it('refuse par le fil ce que le juge refuse en mémoire', async () => {
    const bad = { ...sampleInput(Product, { sku: 'WIRE-2' }), cents: -1 };

    await expect(call(
      { entity: 'product', op: 'create' },
      { params: {}, query: {}, body: bad, state: {} },
    )).rejects.toThrow(/cents/);
  });
});
