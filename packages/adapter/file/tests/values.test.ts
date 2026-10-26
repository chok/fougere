/**
 * A value is ONE file named after its entity, beside the directories that hold rows — so
 * `config/prod/meili.yaml` is what `values: ['Meili']` reads under `path: 'config/prod'`.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entity, text, url } from '@fougere/schema';
import { describe, expect, it } from 'vitest';
import { createFileSource } from '../src/index.js';

class Meili extends entity({ url: url(), key: text() }) {}

const directory = () => mkdtempSync(join(tmpdir(), 'fougere-values-'));

describe('a value in a file', () => {
  it('is read from the file named after its entity, in either format', async () => {
    const path = directory();
    writeFileSync(join(path, 'meili.yaml'), 'url: https://meili.test\nkey: k\n');

    expect(await createFileSource({ path }).value!(Meili, 'meili')).toEqual({ url: 'https://meili.test', key: 'k' });
  });

  it('is absent when no file holds it, and says the file to write', async () => {
    const path = directory();
    const source = createFileSource({ path });

    expect(await source.value!(Meili, 'meili')).toBeUndefined();
    expect(source.valueAt!(Meili, 'meili')).toBe(`${join(path, 'meili')}.json|yaml, which does not exist`);
  });

  it('names the file it read', () => {
    const path = directory();
    writeFileSync(join(path, 'meili.json'), '{}');

    expect(createFileSource({ path }).valueAt!(Meili, 'meili')).toBe(join(path, 'meili.json'));
  });
});
