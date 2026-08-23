import { afterAll } from 'vitest';
import { join } from 'node:path';
import { checkDoorContract, testApp } from '../src/index.js';
import Absence from './fixtures-absence/fronds/semantics/entities/Absence.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures-absence') });
afterAll(() => app.dispose());

checkDoorContract(app, Absence, [
  {
    name: '`foo?: T` — absent reaches the handler as undefined',
    operation: 'inspect',
    input: { body: { requiredNullable: 'value', optionalNullable: 'value' } },
    expected: {
      optionalOnly: 'undefined',
      requiredNullable: 'value',
      optionalNullable: 'value',
      ownsOptionalNullable: true,
    },
  },
  {
    name: '`foo: T | null` — explicit null remains null',
    operation: 'inspect',
    input: { body: { optionalOnly: 'value', requiredNullable: null, optionalNullable: 'value' } },
    expected: {
      optionalOnly: 'value',
      requiredNullable: 'null',
      optionalNullable: 'value',
      ownsOptionalNullable: true,
    },
  },
  {
    name: '`foo?: T | null` — absence remains distinct from null',
    operation: 'inspect',
    input: { body: { optionalOnly: 'value', requiredNullable: 'value' } },
    expected: {
      optionalOnly: 'value',
      requiredNullable: 'value',
      optionalNullable: 'undefined',
      ownsOptionalNullable: false,
    },
  },
  {
    name: '`foo?: T | null` — explicit null is never normalized away',
    operation: 'inspect',
    input: { body: { optionalOnly: 'value', requiredNullable: 'value', optionalNullable: null } },
    expected: {
      optionalOnly: 'value',
      requiredNullable: 'value',
      optionalNullable: 'null',
      ownsOptionalNullable: true,
    },
  },
]);
