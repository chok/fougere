/**
 * `fougere check` — ce qui ne tient pas dans une app, dérivé de ses déclarations.
 *
 * Le handler ne boote pas la cible : il la scanne (`ProjectScan`). Un boot lancerait
 * ses migrations et ses seeds, donc un « contrôle » qui écrirait dans la base qu'il
 * inspecte. Ce test appelle le handler directement, sans CLI et sans processus.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import CheckHandler from '../fronds/analysis/handlers/CheckHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';

const fixture = join(import.meta.dirname, 'fixtures-check');
const check = () => new CheckHandler(new ProjectScan());

describe('check', () => {
  it('nomme un extends qu\'il n\'a pas pu suivre, et compte ce qu\'il a vu', async () => {
    const result = await check().execute({ root: fixture });

    expect(result.fronds).toBe(1);
    expect(result.handlers).toBe(1);

    const found = result.findings.find((f) => f.code === 'heritage-unresolved');
    expect(found, 'aucun constat sur un extends non résolu').toBeDefined();
    expect(found!.severity).toBe('warning');
    expect(found!.message).toContain('BaseReporting');
    expect(found!.filePath).toContain('ArticleHandler.ts');
  });

  it('ne signale rien sur une app du dépôt', async () => {
    // Le zéro ici ne dit pas « tout va bien » — il dit « aucun faux positif sur du
    // vrai code ». Un vérificateur qui crie au loup cesse d'être lu.
    const root = join(import.meta.dirname, '..', '..', '..', 'demos', 'multi-frond', 'remote-blog');
    const result = await check().execute({ root });

    expect(result.fronds).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });
});
