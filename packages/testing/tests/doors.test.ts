import { afterAll } from 'vitest';
import { join } from 'node:path';
import { checkDoors, testApp } from '../src/index.js';
import Article from './fixtures/fronds/press/entities/Article.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures'), fronds: ['press'] });
afterAll(() => app.dispose());

// Includes the same CRUD call and the same refusal through local, RPC, REST and GraphQL.
checkDoors(app, Article, {
  given: { title: 'One contract', body: 'Across every door', status: 'draft', views: 1 },
});
