/**
 * `abstract` is erased, so only the source can say a class is a port and never a realization.
 *
 * Read at runtime, `CardPayment` between `Payment` and `StripePayment` looks like a second
 * realization of `Payment`, and the boot refuses two. The scan reads the keyword and carries it.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { basesOf } from '@fougere/core/descriptor';
import { scanProject } from '../src/scan/scanner.js';

const project = join(import.meta.dirname, 'fixtures-abstract-port');

describe('an abstract class between a port and its realization', () => {
  it('is carried as abstract, and the concrete class is not', async () => {
    const { fronds } = await scanProject(project);

    const abstract = fronds[0].providers.filter((p) => p.abstract).map((p) => p.name).sort();

    expect(abstract).toEqual(['CardPayment', 'Payment']);
  });

  it('leaves the class below as the one candidate for both ports', async () => {
    const { fronds } = await scanProject(project);
    const declared = new Set(fronds[0].providers.map((p) => p.name));

    const bases = basesOf(fronds[0].providers, (name) => declared.has(name));

    expect([...bases].map(([port, all]) => [port, all.map((p) => p.name)])).toEqual([
      ['CardPayment', ['StripePayment']],
      ['Payment', ['StripePayment']],
    ]);
  });
});
