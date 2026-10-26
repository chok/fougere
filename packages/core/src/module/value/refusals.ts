import { lowerFirst, upperFirst } from '@fougere/schema';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { Diagnostic } from '../../diagnostic.js';
import { targetOf } from '../../prefab/prefab.js';
import { ownedBy, repositoryKeyOf } from '../../prefab/RepositoryConstructor.js';
import { storageKeyOf } from '../../storage/Storage.js';

interface Declared {
  ctor: { name: string };
  deps: string[];
  filePath: string;
}

/**
 * An entity is rows or one value, and asking for it the other way is said at boot — the
 * container would only answer that the key is not registered.
 */
export function refuseValuesAsRows(
  frond: FrondDescriptor,
  valued: (entity: string) => boolean,
  entities: ReadonlySet<string>,
  refused: Diagnostic[],
): void {
  const declared: Declared[] = [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors];
  const provided = new Set(frond.providers.map((provider) => provider.ctor.name));

  for (const decl of declared) {
    const builtOn = [...ownedBy(decl.ctor), ...[targetOf(decl.ctor)].filter((one) => one !== undefined)]
      .map((entity) => lowerFirst((entity as { name: string }).name));
    for (const entity of builtOn.filter(valued)) refused.push(asRows(frond, decl, entity, decl.ctor.name));

    for (const dep of decl.deps) {
      const entity = [...entities].find((name) => dep === repositoryKeyOf(name) || dep === storageKeyOf(name));
      if (entity && valued(entity)) refused.push(asRows(frond, decl, entity, dep));

      const asked = lowerFirst(dep);
      if (dep === upperFirst(asked) && entities.has(asked) && !valued(asked) && !provided.has(dep)) {
        refused.push({
          severity: 'blocking',
          code: 'rows-as-value',
          filePath: decl.filePath,
          frond: frond.name,
          subject: `${decl.ctor.name}(${dep})`,
          message: `${decl.ctor.name} asks for ${dep} as one value, and ${dep} is held as rows. `
            + `Ask for its repository, or list '${dep}' in the values: of a source.`,
        });
      }
    }
  }
}

function asRows(frond: FrondDescriptor, decl: Declared, entity: string, asked: string): Diagnostic {
  const name = upperFirst(entity);

  return {
    severity: 'blocking',
    code: 'value-as-rows',
    filePath: decl.filePath,
    frond: frond.name,
    subject: `${decl.ctor.name}(${asked})`,
    message: `${decl.ctor.name} reaches ${name} as rows, and ${name} is held as one value. `
      + `Ask for the value itself: constructor(private ${entity}: ${name}) {}.`,
  };
}
