/**
 * CRAN 1 — un frond.
 *
 * Ce fichier est dans `fronds/catalog/tests/`, et ça suffit : `testApp()` ne reçoit
 * aucun argument. La position dit le projet et dit le sujet, exactement comme
 * `entities/` dit à la lecture ce qu'un dossier contient. Le frond `orders` n'est pas
 * monté — même énoncé que `remotes:` en production.
 */
import { describe, it, expect } from 'vitest';
import { createLocalRunner } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { testApp, sampleInput } from '@fougere/testing';
import Product from '../entities/Product.js';
import Pricing from '../services/Pricing.js';

describe('le frond catalog, seul', () => {
  it('ne monte que lui', async () => {
    await using app = await testApp();

    expect(app.fronds.map((frond) => frond.name)).toEqual(['catalog']);
  });

  it('facture au tarif que la réalisation applique', async () => {
    await using app = await testApp();

    const quote = await createLocalRunner(app)({ entity: 'product', op: 'quote' }, {
      ...EMPTY_INVOCATION,
      input: sampleInput(Product, { sku: 'ABC-01', cents: 1000 }),
    });

    // `class VatPricing extends Pricing` EST l'enregistrement : personne ne le câble.
    expect(quote).toEqual({ sku: 'ABC-01', total: 1200 });
  });

  it('facture ce que le test décide, quand le tarif est bouché', async () => {
    await using app = await testApp({ stub: [Pricing] });
    app.stub(Pricing).total.mockReturnValue(4242);

    const quote = await createLocalRunner(app)({ entity: 'product', op: 'quote' }, {
      ...EMPTY_INVOCATION,
      input: sampleInput(Product, { sku: 'ABC-01', cents: 1000 }),
    });

    expect(quote).toEqual({ sku: 'ABC-01', total: 4242 });
    expect(app.stub(Pricing).total).toHaveBeenCalledWith(1000);
  });
});
