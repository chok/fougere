/**
 * A provider does not take an entity's storage key.
 *
 * `bootstrap.ts` registers the providers, then the storages, and `registerValue` is a plain
 * `registry.set` — so a provider named `PostStorage` was overwritten by `post`'s own storage
 * and never resolved. Nothing said so: the class was declared, registered, and silently gone.
 */
import { describe, it, expect } from 'vitest';
import { refuseStorageInUserCode } from '../src/boot/ownership.js';
import type { FrondDescriptor, ProviderEntry } from '../src/descriptor/frond.js';

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

const declared = (entity: string) => entity === 'post';
const refuse = (frond: FrondDescriptor) => () => refuseStorageInUserCode(frond, new Map(), declared);

describe('a provider registered under an entity storage key', () => {
  it('is refused, naming the entity that holds the key', () => {
    expect(refuse(frondWith({ ctor: PostStorage }))).toThrow(/PostStorage is a provider/);
    expect(refuse(frondWith({ ctor: PostStorage }))).toThrow(/post's/);
  });

  it('reads the name the boot registers, not the class name', () => {
    // A bundler lowering a static field renames the declaration; `ProviderEntry.name` is
    // what the container is keyed on, and it is what collides.
    expect(refuse(frondWith({ name: 'PostStorage', ctor: class _P {} })))
      .toThrow(/PostStorage is a provider/);
  });

  it('lets a name that is not a storage key through', () => {
    expect(refuse(frondWith({ ctor: PostCatalog }))).not.toThrow();
  });

  it('says nothing about an entity the app does not declare', () => {
    // `entityOfStorageKey` answers on a DECLARED entity only — `FileStorage` is an ordinary
    // provider in an app that declares no `file` entity.
    const frond = frondWith({ ctor: class FileStorage {} });
    expect(() => refuseStorageInUserCode(frond, new Map(), () => false)).not.toThrow();
  });
});
