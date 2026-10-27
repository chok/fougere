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

    expect(found.map((d) => d.subject).sort()).toEqual(['LonePayment', 'StripePayment']);
    found.sort((a, b) => b.subject.localeCompare(a.subject));
    expect(found[0].severity).toBe('warning');
    expect(found[0].subject).toBe('StripePayment');
    expect(found[0].message).toContain('StripePayment implements Payment, so it is not used for Payment');
    expect(found[0].filePath).toContain('StripePayment');
  });

  it('says nothing about a class implementing an interface', async () => {
    const { diagnostics } = await scanProject(project);

    expect(diagnostics.map((d) => d.subject)).not.toContain('Clock');
  });

  it('serves the frond anyway — the class is still a provider', async () => {
    const { fronds } = await scanProject(project);

    expect(fronds[0].providers.map((p) => p.name).sort()).toEqual(['AuditPayment', 'Clock', 'LonePayment', 'Payment', 'StripePayment']);
  });
});

describe('a class that implements part of a port', () => {
  it('is a link when it asks for the port, carried as what it implements', async () => {
    const { fronds, diagnostics } = await scanProject(project);
    const audit = fronds[0].providers.find((p) => p.name === 'AuditPayment')!;

    expect(audit.implements).toEqual(['Payment']);
    expect(diagnostics.map((d) => d.subject)).not.toContain('AuditPayment');
  });

  it('is said when it asks for nothing, naming the inner to take', async () => {
    const { diagnostics } = await scanProject(project);
    const lone = diagnostics.find((d) => d.subject === 'LonePayment')!;

    expect(lone.message).toContain('LonePayment implements Partial<Payment> but takes no Payment');
    expect(lone.message).toContain('constructor(private inner: Payment)');
  });
});
