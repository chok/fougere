/**
 * DÉMO (exécutable) — l'intérêt de `class X extends entity({…})` vs `const`,
 * et ce que tu peux/dois mettre dans le corps.
 *
 * Trois choses prouvées ici :
 *   1. Le nom de l'entity est un TYPE → handler `(o: Order)` sans Infer.
 *   2. Le corps est une vraie classe → getters / toString / validate cross-champ marchent.
 *   3. MAIS tout ce qui est dans le corps est INVISIBLE au pipeline déclaratif
 *      (describe / reconstruct / adapters). C'est ça l'arbitrage.
 */
import { describe as group, it, expect } from 'vitest';
import { entity, primary, text, number, oneOf, describe, reconstruct } from '../src/index.js';

// ─── 1 · Le payoff de la classe : un nom = type + valeur ──────────────

class Order extends entity({
  id: primary(),
  status: oneOf('pending', 'paid', 'shipped'),
  total: number({ min: 0 }),
}) {}

// `Order` EST le type. Pas de InferView, pas de InstanceType<typeof Order>.
// (Avec `const Order = entity(...)`, cette signature NE COMPILE PAS — voir le bloc tsc.)
function summarize(o: Order): string {
  return `${o.id} → ${o.status} (${o.total}€)`;
}

group('1 · entity name as type', () => {
  it('un handler annote o: Order et reçoit une vraie instance', () => {
    const o = new Order({ id: 'o1', status: 'paid', total: 100 });
    expect(o).toBeInstanceOf(Order);          // instanceof marche (vrai constructeur)
    expect(summarize(o)).toBe('o1 → paid (100€)');
  });
});

// ─── 2 · Le corps est une vraie classe — cas d'usage légitimes ────────

class Invoice extends entity({
  number: primary(),
  customer: text({ min: 1 }),
  amount: number({ min: 0 }),
}) {
  // (a) getter dérivé de ses PROPRES champs — pur, sans I/O, sans DI
  get label(): string {
    return `#${this.number} — ${this.customer} (${this.amount}€)`;
  }
  // (b) toString — confort de debug / log
  toString(): string {
    return this.label;
  }
}

group('2 · class body conveniences', () => {
  it('getter + toString fonctionnent à runtime', () => {
    const inv = new Invoice({ number: 'INV-1', customer: 'Acme', amount: 42 });
    expect(inv.label).toBe('#INV-1 — Acme (42€)');
    expect(`${inv}`).toBe('#INV-1 — Acme (42€)');   // template string → toString
  });

  it('MAIS le pipeline déclaratif ne voit pas `label` — il dérive des FIELDS', () => {
    // describe() lit getFields(), pas le prototype → `label` absent du descripteur.
    expect(Object.keys(describe(Invoice).properties)).toEqual(['number', 'customer', 'amount']);
    // donc un schéma reconstruit depuis la carte n'a PAS le getter.
    const rebuilt = reconstruct(describe(Invoice));
    // `in` already answers a boolean, so the `?? {}` that used to sit here was dead
    // and, worse, applied to the whole comparison rather than to the prototype.
    expect('label' in (rebuilt as { prototype: object }).prototype).toBe(false);
  });
});

// ─── 3 · "étendre validate" — l'escape hatch cross-champ, et son coût ──

class DateRange extends entity({
  start: number(),   // timestamps, to keep it simple
  end: number(),
}) {
  // A cross-field rule the field vocabulary CANNOT express (a shape judges one field at
  // a time). The class body is the only place for it.
  static validate(input: unknown) {
    const base = super.validate(input);
    if (base.success && base.data.start > base.data.end) {
      return { success: false as const, errors: [{ path: 'end', message: 'end < start' }] };
    }
    return base;
  }
}

group('3 · overriding validate (cross-field)', () => {
  it('la règle cross-champ s\'applique quand on appelle DateRange.validate', () => {
    expect(DateRange.validate({ start: 10, end: 5 }).success).toBe(false);
    expect(DateRange.validate({ start: 5, end: 10 }).success).toBe(true);
  });

  it('COÛT : la règle ne traverse pas describe/reconstruct (elle vit hors des axes)', () => {
    const rebuilt = reconstruct(describe(DateRange));
    // le schéma reconstruit ignore la règle cross-champ → accepte un range invalide
    expect(rebuilt.validate({ start: 10, end: 5 }).success).toBe(true);
  });
});
