/**
 * A port is answered by EXTENDING it, and `implements` is erased.
 *
 * `basesOf` reads `Object.getPrototypeOf(ctor).name`, which an `implements` clause never
 * writes — so the boot binds no port, registers the class under its own name, and the first
 * dependency on the port answers `'Payment' is not registered`, naming a key rather than the
 * line at fault. The source is the only place that still holds the intent, which is why the
 * scan is where it is said.
 *
 * A warning and not a refusal: implementing a class is legal TypeScript, and only the author
 * knows whether a port was meant.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/scan/scanner.js';

const project = join(import.meta.dirname, 'fixtures-implements-port');

describe('a class implemented where it should be extended', () => {
  it('is reported, and names the class and the port', async () => {
    const { diagnostics } = await scanProject(project);

    const found = diagnostics.filter((d) => d.code === 'port-implemented-not-extended');

    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].subject).toBe('StripePayment');
    expect(found[0].message).toContain('implements the class Payment');
    expect(found[0].filePath).toContain('StripePayment');
  });

  it('says nothing about a class implementing an interface', async () => {
    const { diagnostics } = await scanProject(project);

    expect(diagnostics.map((d) => d.subject)).not.toContain('Clock');
  });

  it('serves the frond anyway — the class is still a provider', async () => {
    const { fronds } = await scanProject(project);

    expect(fronds[0].providers.map((p) => p.name).sort()).toEqual(['Clock', 'Payment', 'StripePayment']);
  });
});
