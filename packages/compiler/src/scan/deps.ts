import { subjectKeyOf, storageKeyOf, type TypeRef } from '@fougere/core/descriptor';
import { parseConstructorParams } from './handler-parser.js';


/** The container key a constructor parameter asks for, read off its type. */
export function depKeyOf(type: TypeRef): string {
  const target = type.name.endsWith('Storage') && type.generics?.length === 1 ? type.generics[0]?.name : undefined;
  if (target && target !== 'Record') return storageKeyOf(target);

  const subjects = (type.generics ?? []).map((generic) => tupleOf(generic.name)).filter((name) => !DEFAULTS.has(name));

  return subjects.length > 0 ? subjectKeyOf(type.name, ...subjects) : type.name;
}

const DEFAULTS = new Set(['Record', 'never', '[]']);

function tupleOf(raw: string): string {
  if (!raw.startsWith('[')) return raw;

  return `[${raw.replace(/^\[|\]$/g, '').split(',').map((member) => member.trim()).filter(Boolean).join(', ')}]`;
}


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
