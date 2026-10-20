/**
 * What REST publishes of itself: OpenAPI 3.1 read off the routes it serves — the status the door
 * answers, the schema the card already writes, the refusals the op can meet — and Scalar to read
 * it. Nothing is published unless `protocols: { rest: { openapi: true } }` says so.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { describedAt, openApiOf } from '@fougere/adapter-rest';
import { serveRest } from '@fougere/app';
import { testApp } from '../src/index.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures'), fronds: ['press'] });
afterAll(() => app.dispose());

const published = { ...app, protocols: { ...app.protocols, rest: { openapi: true } } };

describe('the OpenAPI document', () => {
  const document = openApiOf(app);
  const collection = document.paths['/api/press/articles']!;
  const row = document.paths['/api/press/articles/{id}']!;

  it('names each route as the door serves it, under its op', () => {
    expect(Object.keys(collection).sort()).toEqual(['get', 'post']);
    expect(Object.keys(row).sort()).toEqual(['delete', 'get', 'patch']);
    expect(row.get).toMatchObject({ operationId: 'article.findById', tags: ['press'], parameters: [{ name: 'id', in: 'path', required: true }] });
  });

  it('says the status the door answers, and the body it answers with', () => {
    expect(Object.keys(collection.post!.responses as object)).toContain('201');
    expect(Object.keys(row.delete!.responses as object)).toContain('204');
    expect((collection.post!.requestBody as { content: Record<string, { schema: unknown }> }).content['application/json']!.schema)
      .toEqual({ $ref: '#/components/schemas/Article' });
  });

  it('lists what the op can refuse, at the status a refusal is answered with', () => {
    const responses = row.get!.responses as Record<string, { 'x-fougere-codes'?: string[] }>;
    const created = collection.post!.responses as Record<string, { 'x-fougere-codes'?: string[] }>;

    expect(responses['404']!['x-fougere-codes']).toEqual(['NOT_FOUND']);
    expect(responses['503']!['x-fougere-codes']).toEqual(['SERVICE_UNAVAILABLE']);
    expect(created['404']).toBeUndefined();
    expect(created['400']!['x-fougere-codes']).toEqual(expect.arrayContaining(['VALIDATION_FAILED', 'BAD_REQUEST']));
  });

  it('writes a schema once, as the card writes it, and says who writes each field', () => {
    const { Article: article, ArticleUpdateInput: patch } = document.components.schemas as Record<string, { properties: Record<string, { readOnly?: boolean }>; required?: string[] }>;

    expect(article).toMatchObject({ title: 'Article', type: 'object', properties: { id: { readOnly: true }, createdAt: { readOnly: true } } });
    expect(patch!.required).toBeUndefined();
    expect(Object.keys(patch!.properties)).not.toContain('id');
  });
});

describe('what REST publishes', () => {
  it('publishes nothing unless the config says so', () => {
    expect(describedAt(app, 'GET', '/api/openapi.json')).toBeUndefined();
  });

  it('serves the document and a page reading it, through the same answer as a route', async () => {
    const json = await serveRest(published, { method: 'GET', path: '/api/openapi.json', query: {}, state: {} });
    const page = await serveRest(published, { method: 'GET', path: '/api/docs', query: {}, state: {} });

    expect(json).toMatchObject({ kind: 'ok', status: 200, body: { openapi: '3.1.0' } });
    expect(page).toMatchObject({ kind: 'ok', raw: true, headers: { 'content-type': 'text/html; charset=utf-8' } });
    expect((page as { body: string }).body).toContain("Scalar.createApiReference('#app', { url: \"/api/openapi.json\" })");
  });
});
