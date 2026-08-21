/**
 * CRAN 4 — un vrai navigateur, une vraie app.
 *
 * Ce que ce cran prouve et qu'aucun autre ne peut : le formulaire n'énonce aucune règle
 * de son côté. Ses contraintes sont celles de `Product`, sous les noms que le navigateur
 * connaît déjà, et le serveur refuse exactement ce que la balise refuse. « Juge local =
 * juge distant » se regarde ici au lieu de se plaider.
 */
import { test, expect } from '@playwright/test';

test('le formulaire porte les contraintes que Product déclare', async ({ page }) => {
  await page.goto('/');

  // Rien de tout cela n'est écrit dans la page : `formFieldsOf` le dérive de l'entité.
  await expect(page.locator('#sku')).toHaveAttribute('minlength', '3');
  await expect(page.locator('#sku')).toHaveAttribute('maxlength', '12');
  await expect(page.locator('#cents')).toHaveAttribute('max', '1000000');
  await expect(page.locator('#status')).toHaveValue('draft');
  await expect(page.locator('#status option')).toHaveCount(3);
});

test('le navigateur refuse ce que le serveur refuserait', async ({ page }) => {
  await page.goto('/');
  await page.fill('#sku', 'AB');           // sous le minimum déclaré
  await page.fill('#name', 'Une lampe');
  await page.fill('#cents', '1000');
  await page.click('button[type=submit]');

  // La page n'a envoyé aucune requête : la contrainte vient de l'entité, et c'est le
  // navigateur qui l'applique. Aucun code de validation dans la page.
  await expect(page.locator('#sku')).toBeFocused();
  await expect(page.locator('#products li')).toHaveCount(0);
});

test('un corps valide traverse la porte et la ligne apparaît', async ({ page }) => {
  await page.goto('/');
  await page.fill('#sku', 'LAMP-01');
  await page.fill('#name', 'Une lampe');
  await page.fill('#cents', '4990');
  await page.click('button[type=submit]');

  await expect(page.locator('#products li[data-sku="LAMP-01"]')).toHaveText('Une lampe');
});

test('le serveur refuse ce que le navigateur a laissé passer', async ({ page }) => {
  await page.goto('/');
  // La balise ne connaît pas la casse ni l'unicité — mais le juge, lui, refuse une clé
  // hors contrat. Le formulaire est contourné exprès, comme le ferait un client écrit.
  const answer = await page.evaluate(async () => {
    const response = await fetch('/_fougere/call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'product.create',
        params: { params: {}, query: {}, body: { sku: 'LAMP-02', name: 'x', cents: 1, status: 'draft', couleur: 'rouge' }, state: {} } }),
    });
    return response.json();
  }) as { error?: { message: string } };

  expect(answer.error?.message).toContain('Unknown field');
});
