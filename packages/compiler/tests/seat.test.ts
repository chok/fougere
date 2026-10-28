/**
 * TypeScript erases `<Book>`, so the scan reads it — climbing the class's bases until core's, and
 * carrying what each parameter stands for through a generic base in between (`Mirror<T> extends
 * Repository<T>`), where the checker hands back `Repository<T>`.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { seatOf } from '@fougere/core/descriptor';
import { scanProject } from '../src/scan/scanner.js';

const root = join(import.meta.dirname, 'fixtures-seat');

describe('the seat a class is built on', () => {
  it('is read through a repository that names its queries, and through a generic base', async () => {
    const { fronds } = await scanProject(root);
    const shelf = fronds.find((frond) => frond.name === 'shelf')!;
    const book = shelf.entities[0]!.entityClass;

    expect(seatOf(shelf.handlers[0]!.ctor)).toEqual([book]);
    expect(shelf.handlers[0]!.operations.has('titled')).toBe(true);
    const mirror = shelf.providers.find((provider) => provider.name === 'BookMirror')!;
    expect(seatOf(mirror.ctor)).toEqual([book]);
    expect(mirror.deps).toEqual(['Storage<Book>']);
  }, 30_000);
});
