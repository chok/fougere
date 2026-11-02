/** `primary()` names `uuidv7`, and the other three are one word away. */
import { describe, it, expect } from 'vitest';
import { Generators, applyCreate, entity, primary, text } from '../src/index.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-([47])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('the generators a key can name', () => {
  it('makes a uuidv7 by default, sorted by the moment it was made', () => {
    class Note extends entity({ id: primary(), body: text() }) {}
    const ids = Array.from({ length: 50 }, () => applyCreate(Note.getFields(), { body: 'b' }).id as string);

    expect(ids.every((id) => UUID.exec(id)?.[1] === '7')).toBe(true);
    expect([...ids].sort()).toEqual(ids);
  });

  it('answers uuid with a v4, nanoid with 21 characters, and keeps cuid2', () => {
    expect(UUID.exec(Generators.resolve('uuid')())?.[1]).toBe('4');
    expect(Generators.resolve('nanoid')()).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(Generators.resolve('cuid2')()).toMatch(/^[a-z][a-z0-9]{23}$/);
  });
});
