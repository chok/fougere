/**
 * « Il n'y a rien » et « je n'ai pas pu regarder » sont deux réponses différentes.
 *
 * Le scan les rendait identiques : `readdir(...).catch(() => [])` et
 * `catch { return map; }`. Une frond dont `presenters/` est illisible était donc
 * servie comme une frond sans presenter — par la façade, par la carte d'identité,
 * par tout lecteur en aval. Aucun d'eux ne pouvait faire la différence.
 *
 * C'est la condition de toute règle portant sur une ABSENCE : elle n'est ferme que
 * si l'analyse atteste sa complétude. Sans ça, un contrôle dérivé annonce
 * « 0 problème » précisément quand il n'a rien lu.
 *
 * Le déclencheur ici est un `presenters` qui est un FICHIER : `readdir` rend
 * `ENOTDIR`, jamais `ENOENT`. Déterministe et portable, là où un `chmod 000`
 * dépend de l'utilisateur qui lance les tests.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/scanner.js';

const blind = join(import.meta.dirname, 'fixtures-scan-blind');
const seeing = join(import.meta.dirname, 'fixtures-same-verdict');

describe('le scan dit ce qu\'il n\'a pas pu faire', () => {
  it('un dossier de convention illisible est rapporté, pas confondu avec un dossier vide', async () => {
    const { fronds, diagnostics } = await scanProject(blind);

    // La frond est servie quand même : refuser le boot échangerait une app
    // partielle contre aucune app.
    expect(fronds.map((f) => f.name)).toEqual(['press']);
    expect(fronds[0].presenters).toEqual([]);

    // Mais l'absence est maintenant qualifiée.
    const found = diagnostics.find((d) => d.code === 'directory-unreadable');
    expect(found, 'aucun diagnostic pour un presenters/ illisible').toBeDefined();
    expect(found!.severity).toBe('blocking');
    expect(found!.filePath).toContain('presenters');
    expect((found!.cause as NodeJS.ErrnoException).code).toBe('ENOTDIR');
  });

  it("un dossier absent reste le cas ordinaire, et ne dit rien", async () => {
    // `fixtures-same-verdict` n'a ni presenters/, ni collectors/, ni seeds/ —
    // la convention, pas un défaut. Un diagnostic ici serait du bruit, et le bruit
    // est ce qui fait qu'on cesse de lire le boot.
    const { fronds, diagnostics } = await scanProject(seeing);

    expect(fronds[0].presenters).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  it('une exécution ne conserve pas les constats de la précédente', async () => {
    await scanProject(blind);
    const { diagnostics } = await scanProject(seeing);

    expect(diagnostics).toEqual([]);
  });
});
