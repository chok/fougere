/**
 * A frond written by hand hands `frond()` its `frond.config.ts` and what TypeScript erases of a
 * computed field, and gets the descriptor the scan would have read.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { frond, Present } from '../src/index.js';

class Book extends entity({ id: primary(), title: text() }) {}
class Hidden extends entity({ id: primary(), note: text() }) {}


class BookPresenter extends Present<Book> {
  async spine(books: { title: string }[]) { return books.map((book) => book.title.toUpperCase()); }
}

describe('frond(), handed its frond.config.ts', () => {
  it('keeps the order its links stand in front of a port, outside in', () => {
    const shelf = frond('shelf', { config: { ports: { Dispatcher: ['Timing', 'Audit'] } } });

    expect(shelf.ports).toEqual({ Dispatcher: ['Timing', 'Audit'] });
  });

  it('exposes what the file names and leaves the rest out', () => {
    const shelf = frond('shelf', { entities: [Book, Hidden], config: { expose: ['Book'] } });

    expect(shelf.entities.map((one) => [one.name, one.exposed])).toEqual([['book', true], ['hidden', false]]);
  });

  it('keeps an override keyed by op, its handler by name', () => {
    const shelf = frond('shelf', { config: { operations: { 'book.archive': { kind: 'command' } } } });

    expect(shelf.operationsOverrides).toEqual({ 'book.archive': { kind: 'command', handlerName: undefined } });
  });
});

describe('frond(), handed a computed field\'s type', () => {
  it('keeps what TypeScript erased, beside the field the class carries', () => {
    const shelf = frond('shelf', {
      entities: [Book],
      presenters: [{ ctor: BookPresenter, presents: Book, fieldMeta: [{ name: 'spine', returnType: 'string', list: false }] }],
    });

    expect(shelf.presenters[0]!.fieldMeta).toEqual([{ name: 'spine', returnType: 'string', list: false }]);
  });
});
