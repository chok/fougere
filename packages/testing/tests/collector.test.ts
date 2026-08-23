import { afterAll } from 'vitest';
import { join } from 'node:path';
import { checkDoorContract, testApp } from '../src/index.js';
import Observed from './fixtures-collector/fronds/blog/entities/Observed.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures-collector') });
afterAll(() => app.dispose());

checkDoorContract(app, Observed, [{
  name: 'a collector has the same provenance through local, RPC, REST and GraphQL',
  operation: 'publish',
  input: { body: { title: 'Ferns' } },
  expected: { title: 'Ferns', role: 'author' },
}]);
