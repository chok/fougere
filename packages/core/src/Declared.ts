import type { AbstractCtor } from './Ctor.js';
import type { DeclaredSubject } from './DeclaredSubject.js';
import type { ProviderEntry } from './descriptor/ProviderEntry.js';

/** A class on its own — a port, which is abstract, included — or a class with what it asks for. */
export type Declared = AbstractCtor
  | (Omit<DeclaredSubject, 'ctor'> & { ctor: AbstractCtor } & Partial<Pick<ProviderEntry, 'name' | 'abstract'>>);
