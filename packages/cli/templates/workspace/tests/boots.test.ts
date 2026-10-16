import { test } from 'vitest';
import { testApp } from '@fougere/testing';

test('the project boots as fougere.config.ts places it', async () => {
  await using app = await testApp({ topology: true });
});
