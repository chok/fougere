/**
 * A provider does not take an entity's storage key.
 *
 * `bootstrap.ts` registers the providers, then the storages, and `registerValue` is a plain
 * `registry.set` — so a provider named `PostStorage` was overwritten by `post`'s own storage
 * and never resolved. Nothing said so: the class was declared, registered, and silently gone.
 */
import { describe, it, expect } from 'vitest';
import { storageInUserCode } from '../src/boot/ownership.js';
import type { Diagnostic } from '../src/diagnostic.js';
import type { FrondDescriptor } from '../src/descriptor/FrondDescriptor.js';
import type { ProviderEntry } from '../src/descriptor/ProviderEntry.js';

class PostStorage {}
class PostCatalog {}

function frondWith(provider: Partial<ProviderEntry>): FrondDescriptor {
  return {
    name: 'blog',
    source: { path: '/blog' } as FrondDescriptor['source'],
    providers: [{ ctor: PostCatalog, deps: [], filePath: 'provider.ts', ...provider } as ProviderEntry],
    entities: [], handlers: [], presenters: [], collectors: [], seeds: [], middlewares: [],
  };
}

// Annotated, so TS 5.5 does not infer `entity is 'post'` and close the parameter to the
// test below, which hands in a predicate that declares nothing.
const declared = (entity: string): boolean => entity === 'post';

function refusalsOf(frond: FrondDescriptor, known = declared): Diagnostic[] {
  const refused: Diagnostic[] = [];
  storageInUserCode(frond, new Map(), known, refused);

  return refused;
}

const messageOf = (frond: FrondDescriptor) => refusalsOf(frond).map((one) => one.message).join('\n');

describe('a provider registered under an entity storage key', () => {
  it('is refused, naming the entity that holds the key', () => {
    expect(messageOf(frondWith({ ctor: PostStorage }))).toMatch(/PostStorage is a provider/);
    expect(messageOf(frondWith({ ctor: PostStorage }))).toMatch(/post's/);
    expect(refusalsOf(frondWith({ ctor: PostStorage }))[0]?.code).toBe('storage-key-is-provider');
  });

  it('reads the name the boot registers, not the class name', () => {
    // A bundler lowering a static field renames the declaration; `ProviderEntry.name` is
    // what the container is keyed on, and it is what collides.
    expect(messageOf(frondWith({ name: 'PostStorage', ctor: class _P {} })))
      .toMatch(/PostStorage is a provider/);
  });

  it('lets a name that is not a storage key through', () => {
    expect(refusalsOf(frondWith({ ctor: PostCatalog }))).toEqual([]);
  });

  it('says nothing about an entity the app does not declare', () => {
    // `entityOfStorageKey` answers on a DECLARED entity only — `FileStorage` is an ordinary
    // provider in an app that declares no `file` entity.
    const frond = frondWith({ ctor: class FileStorage {} });
    expect(refusalsOf(frond, () => false)).toEqual([]);
  });
});
