import { subjectKeyOf, storageKeyOf, type TypeRef } from '@fougere/core/descriptor';
import { parseConstructorParams } from './handler-parser.js';

// Scan

/**
 * The container key a constructor parameter asks for — derived from its TYPE, not from how the
 * type was spelled.
 */
export function depKeyOf(type: TypeRef): string {
  // A prefix does not change the key — `MeiliStorage<Card>` is `Card`'s storage. A class named
  // `FileStorage` is untouched: it carries no generic.
  const target = type.name.endsWith('Storage') && type.generics?.length === 1 ? type.generics[0]?.name : undefined;
  if (target && target !== 'Record') return storageKeyOf(target);

  // Every other port with a subject is keyed as it is written — `Repository<Post>`, `Facade<PostHandler>`,
  // `Emit<CanBook, Verdict>`, `Together<[Account, Ledger]>`, `Rest<NoteHandler>` — and a class extending or
  // implementing the same type declares the same key (`Implemented.ts`). `Record`, `never` and `[]` are defaults
  // the checker fills in (`Storage<T = Record<…>>`, `Dispatcher<H = never>`, `Together<T, P = []>`): they name no subject.
  const subjects = (type.generics ?? []).map((generic) => tupleOf(generic.name)).filter((name) => !DEFAULTS.has(name));

  return subjects.length > 0 ? subjectKeyOf(type.name, ...subjects) : type.name;
}

const DEFAULTS = new Set(['Record', 'never', '[]']);

/** A tuple as the key writes it — `'[Account,Ledger]'` → `'[Account, Ledger]'` — and any other name as it is. */
function tupleOf(raw: string): string {
  if (!raw.startsWith('[')) return raw;

  return `[${raw.replace(/^\[|\]$/g, '').split(',').map((member) => member.trim()).filter(Boolean).join(', ')}]`;
}


/** What the checker answers for a type it could not resolve — no key can be read from it. */
const UNRESOLVED = new Set(['any', 'unknown']);

/** The container keys a constructor asks for — refused when a parameter names no type the checker resolved. */
export async function depsOf(filePath: string): Promise<string[]> {
  const params = await parseConstructorParams(filePath);

  return params.map((param) => {
    const named = [param.type, ...(param.type.generics ?? [])].find((type) => UNRESOLVED.has(type.name));
    if (named) {
      throw new Error(
        `${filePath}: TypeScript cannot follow the import of '${param.name}: ${param.type.raw}'. `
        + 'Add `"extends": "@fougere/core/tsconfig"` to the project\'s tsconfig.json.',
      );
    }

    return depKeyOf(param.type);
  });
}
