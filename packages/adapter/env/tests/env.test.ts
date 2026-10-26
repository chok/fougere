/**
 * `MEILI_URL` is Meili's url: one variable per field, read as its shape says, judged by the
 * boot like any other value — and nothing is ever written back.
 */
import { describe, expect, it } from 'vitest';
import { bool, entity, json, number, primary, text, url } from '@fougere/schema';
import { Sources } from '@fougere/core';
import { createEnvSource, Env } from '../src/index.js';

class Meili extends entity({ url: url(), key: text(), timeoutMs: number({ integer: true }), tls: bool(), indexes: json() }) {}
class Index extends entity({ name: primary(text()), url: url() }) {}
class Clash extends entity({ name: primary(text()), url: url(), booksUrl: url() }) {}

describe('a value read off the environment', () => {
  it('reads ENTITY_FIELD, each as its shape declares', async () => {
    const source = createEnvSource({
      MEILI_URL: 'https://meili.test', MEILI_KEY: 'k', MEILI_TIMEOUT_MS: '2500', MEILI_TLS: 'false', MEILI_INDEXES: '["books"]',
    });

    expect(await source.value!(Meili, 'meili')).toEqual({
      url: 'https://meili.test', key: 'k', timeoutMs: 2500, tls: false, indexes: ['books'],
    });
  });

  it('leaves out a field no variable sets, and answers nothing when none is set', async () => {
    expect(await createEnvSource({ MEILI_URL: 'https://meili.test' }).value!(Meili, 'meili')).toEqual({ url: 'https://meili.test' });
    expect(await createEnvSource({}).value!(Meili, 'meili')).toBeUndefined();
  });

  it('says the variable to set', () => {
    expect(createEnvSource({}).valueAt!(Meili, 'meili', 'timeoutMs')).toBe('MEILI_TIMEOUT_MS');
    expect(createEnvSource({}).valueAt!(Meili, 'meili')).toBe('MEILI_*');
  });
});

describe('rows read off the environment', () => {
  it('reads the key from what sits between the entity and a field', async () => {
    const storage = createEnvSource({ INDEX_BOOKS_URL: 'https://a.test', INDEX_PROD_AUTHORS_URL: 'https://b.test' })
      .storageFactory(Index, 'index');

    expect(await storage.findById('books')).toEqual({ name: 'books', url: 'https://a.test' });
    expect(await storage.findById('prod_authors')).toEqual({ name: 'prod_authors', url: 'https://b.test' });
  });

  it('refuses two fields that end alike, when the storage is made', () => {
    expect(() => createEnvSource({}).storageFactory(Clash, 'clash'))
      .toThrow(/clash\.booksUrl ends like clash\.url/);
  });

  it('refuses every write, naming the variable to change', async () => {
    const storage = createEnvSource({}).storageFactory(Index, 'index');

    await expect(storage.create({ name: 'books', url: 'https://a.test' })).rejects.toThrow(/source 'env' is read-only.*INDEX_BOOKS_\*/);
  });
});

describe('the env source type', () => {
  it('is never the source holding the rest', () => {
    expect(Sources.find('env')?.readOnly).toBe(true);
  });

  it('reads the process environment by default', async () => {
    process.env.PROBE_URL = 'https://probe.test';
    class Probe extends entity({ url: url() }) {}

    expect(new Env().value(Probe, 'probe')).toEqual({ url: 'https://probe.test' });
    delete process.env.PROBE_URL;
  });
});
