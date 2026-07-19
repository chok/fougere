import { describe, it, expect } from 'vitest';
import { Validator } from '@cfworker/json-schema';

/**
 * Lot 1 · cran 1 — l'engine face aux unions nullables.
 *
 * Prérequis du chantier field-axes : la nullité déménage du bit plat vers le
 * shape (`type: ['string','null']`, `enum: [..., null]`). Ces tests prouvent
 * que @cfworker/json-schema juge ces unions correctement AVANT qu'on branche
 * quoi que ce soit — risque n°2 de la note, réglé par preuve.
 */

const v = (schema: object) => new Validator(schema as never, '2020-12', true);

describe('engine cfworker — unions de types avec null', () => {
  it('type: [string, null] accepte la string et null, rejette le reste', () => {
    const val = v({ type: ['string', 'null'] });
    expect(val.validate('hello').valid).toBe(true);
    expect(val.validate(null).valid).toBe(true);
    expect(val.validate(42).valid).toBe(false);
    // undefined n'est pas une valeur JSON : l'engine THROW au lieu de juger.
    // Sans incidence — l'absence est traitée par validateFields AVANT l'engine.
    expect(() => val.validate(undefined)).toThrow();
  });

  it('les contraintes du type de base ne s’appliquent qu’au type de base', () => {
    const val = v({ type: ['string', 'null'], minLength: 3 });
    expect(val.validate('abcd').valid).toBe(true);
    expect(val.validate('ab').valid).toBe(false);
    // minLength ne contraint que les strings — null passe (sémantique JSON Schema)
    expect(val.validate(null).valid).toBe(true);
  });

  it('type: [number, null] + minimum', () => {
    const val = v({ type: ['number', 'null'], minimum: 0 });
    expect(val.validate(5).valid).toBe(true);
    expect(val.validate(-1).valid).toBe(false);
    expect(val.validate(null).valid).toBe(true);
  });

  it('type: [integer, null] rejette les décimaux, accepte null', () => {
    const val = v({ type: ['integer', 'null'] });
    expect(val.validate(3).valid).toBe(true);
    expect(val.validate(3.5).valid).toBe(false);
    expect(val.validate(null).valid).toBe(true);
  });
});

describe('engine cfworker — enum avec null (le cas oneOf)', () => {
  it('enum: [vals..., null] accepte les valeurs et null', () => {
    const val = v({ enum: ['draft', 'published', null] });
    expect(val.validate('draft').valid).toBe(true);
    expect(val.validate(null).valid).toBe(true);
    expect(val.validate('archived').valid).toBe(false);
  });

  it('enum SANS null rejette null (le cas non-nullable reste strict)', () => {
    const val = v({ enum: ['draft', 'published'] });
    expect(val.validate(null).valid).toBe(false);
  });
});

describe('engine cfworker — format date-time sous union', () => {
  it('la string ISO passe, null passe, la string non-ISO suit le comportement format', () => {
    const val = v({ type: ['string', 'null'], format: 'date-time' });
    expect(val.validate('2026-06-12T10:00:00Z').valid).toBe(true);
    expect(val.validate(null).valid).toBe(true);
    // NOTE : ce test documente le comportement réel de l'engine sur format —
    // si format n'est pas assertif chez cfworker, ce expect sera ajusté en
    // connaissance de cause (le chemin Date vivante reste géré côté checkValue).
    expect(val.validate('pas-une-date').valid).toBe(false);
  });
});

describe('engine cfworker — référence : le shape actuel (non-union) reste strict', () => {
  it('type: string seul rejette null (aucun changement pour les champs non-nullables)', () => {
    const val = v({ type: 'string' });
    expect(val.validate(null).valid).toBe(false);
  });
});
