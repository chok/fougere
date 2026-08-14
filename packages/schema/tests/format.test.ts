import { describe, it, expect } from 'vitest';
import { Formats,
  entity,
  text,
  email,
  optional,
  describe as describeSchema,
  reconstruct,
} from '../src/index.js';

// A deliberately trivial predicate — what matters is that the NAME is what the
// field declares and what the card carries, not what the closure does.
Formats.register('siret', (v) => /^\d{14}$/.test(v));

describe('registerFormat — a named predicate on the shape axis', () => {
  it('judges a value the built-in vocabulary cannot express', () => {
    class Firm extends entity({ siret: text({ format: 'siret' }) }) {}

    expect(Firm.validate({ siret: '73282932000074' }).success).toBe(true);

    const bad = Firm.validate({ siret: 'pas-un-siret' });
    expect(bad.success).toBe(false);
    expect(bad.success === false && bad.errors[0]).toEqual({
      path: 'siret',
      message: 'String does not match format "siret".',
    });
  });

  it('composes with the rest of the shape rather than replacing it', () => {
    // The engine judges minLength; ours judges the digits. Both must pass, and the
    // engine speaks first — a value that is too short never reaches the predicate.
    class Firm extends entity({ siret: text({ min: 14, format: 'siret' }) }) {}

    const short = Firm.validate({ siret: '732' });
    expect(short.success).toBe(false);
    expect(short.success === false && short.errors[0]?.message).toMatch(/too short/);
  });

  it('leaves absence and null to the axes that own them', () => {
    class Firm extends entity({ siret: optional(text({ format: 'siret' })) }) {}
    expect(Firm.validate({}).success).toBe(true);
    expect(Firm.validate({ siret: null }).success).toBe(true);
  });
});

describe('the name is the contract — it survives the card', () => {
  it('travels through describe() and still judges after reconstruct()', () => {
    class Firm extends entity({ siret: text({ format: 'siret' }) }) {}

    const card = describeSchema(Firm);
    // The card carries a plain JSON Schema `format`, which is what makes the rule
    // readable by a consumer that has never heard of Fougere.
    expect((card.properties.siret as { format?: string }).format).toBe('siret');
    expect(JSON.parse(JSON.stringify(card)).properties.siret.format).toBe('siret');

    const Rebuilt = reconstruct(card);
    expect(Rebuilt.validate({ siret: '73282932000074' }).success).toBe(true);
    expect(Rebuilt.validate({ siret: 'nope' }).success).toBe(false);
  });
});

describe('an unregistered format is refused, never ignored', () => {
  it('throws at judgment and names the remedy', () => {
    // The engine would let EVERY value through: `format[$format] && …` skips a name
    // it does not know. Silence here is the failure mode this repo refuses.
    class Broken extends entity({ n: text({ format: 'siren' }) }) {}

    expect(() => Broken.validate({ n: 'whatever' })).toThrow(
      /Unknown format: 'siren'\. Register it with Formats.register\('siren', …\)/,
    );
  });

  it('does not throw for a format the engine judges natively', () => {
    class U extends entity({ mail: email() }) {}
    expect(U.validate({ mail: 'a@b.co' }).success).toBe(true);
    expect(U.validate({ mail: 'pas-un-email' }).success).toBe(false);
  });
});

describe('registering over a built-in is cumulative', () => {
  it('adds a rule to the standard one instead of replacing it', () => {
    Formats.register('email', (v) => v.endsWith('@fougere.dev'));
    class Staff extends entity({ mail: email() }) {}

    // Still an e-mail by the engine's rule…
    expect(Staff.validate({ mail: 'pas-un-email-du-tout' }).success).toBe(false);
    // …and now also ours.
    expect(Staff.validate({ mail: 'a@b.co' }).success).toBe(false);
    expect(Staff.validate({ mail: 'chok@fougere.dev' }).success).toBe(true);
  });
});
