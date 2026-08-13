import { describe, expect, it } from 'vitest';
import { Field, entity, primary, text } from '../src/index.js';

/**
 * The constructor is the only way to obtain a field, so it is where a field is judged —
 * and where hostile input stops. Both halves are pinned here because both were reachable:
 * `new Field({})` used to be legal from any caller without a compiler, and assigning the
 * slots wholesale used to be a one-line simplification with a prototype hole under it.
 */
describe('the field door', () => {
  it('refuses what is not a field, and names the key when it was given one', () => {
    expect(() => new Field({} as never)).toThrow(/not a field/);
    expect(() => new Field({} as never, 'vide')).toThrow(/Field 'vide': not a field/);
    expect(() => entity({ id: primary(), vide: {} as never })).toThrow(/Field 'vide': not a field/);
  });

  it('takes a plain object — a config, plain JS, a card another language wrote', () => {
    const plain = { shape: { type: 'string', minLength: 3 } } as unknown as Field<string>;
    const Foreign = entity({ id: primary(), title: plain });
    const field = Foreign.getFields().title;
    expect(field).toBeInstanceOf(Field);
    expect(typeof field.with).toBe('function');

    const short = Foreign.validate({ id: 'x', title: 'ab' });
    expect(short.success).toBe(false);
  });

  it('keeps the five slots and nothing else', () => {
    const f = new Field({ shape: { type: 'string' }, nawak: 42 } as never);
    expect('nawak' in f).toBe(false);
  });

  it('survives a card carrying __proto__ — the input this door exists to accept', () => {
    // `Object.assign(this, init)` would copy through [[Set]], firing the `__proto__`
    // setter: the field would lose `with` and gain whatever the sender put there.
    const hostile = JSON.parse('{"shape":{"type":"string"},"__proto__":{"polluted":true}}');
    const f = new Field(hostile);

    expect(Object.getPrototypeOf(f)).toBe(Field.prototype);
    expect(typeof f.with).toBe('function');
    expect((f as unknown as { polluted?: boolean }).polluted).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();  // nor globally
  });

  it('a field built from the vocabulary is the same thing', () => {
    expect(text()).toBeInstanceOf(Field);
    expect(text().with({ meta: { description: 'x' } }).shape).toEqual({ type: 'string' });
  });
});
