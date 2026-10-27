import { applyCreate, InputValidator, dotted, upperFirst } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { BootRefusal } from '../../BootRefusal.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { ValueSources } from './ValueSources.js';
import { envKeyOf, type Env } from './Env.js';

/** What this member reads of the app, and the slot of the ascent it fills. */
interface Valuing {
  name: 'values';
  up?(app: { fronds: readonly FrondDescriptor[]; container: Container }): Promise<void>;
}

/**
 * Each entity held as a value is read, completed by its defaults, judged, and registered in the
 * scope of the frond declaring it — so `constructor(meili: Meili)` receives it as it is. After the
 * schema, since a source keeping values in a table needs that table first.
 *
 * Documented: [values](https://fougere.dev/docs/business/values).
 */
export function valuing(values?: ValueSources): Valuing {
  if (!values) return { name: 'values' };

  return {
    name: 'values',
    up: async (app) => {
      const refusals: string[] = [];
      for (const frond of app.fronds) {
        const scopeKey = `frond:${frond.name}`;
        if (!app.container.has(scopeKey)) continue;
        const scope = app.container.resolve<Container>(scopeKey);

        for (const { name, entityClass } of frond.entities) {
          if (values.sourceOf(name) === undefined) continue;
          const fields = entityClass.getFields();
          // Through what stands in front of it, when anything does: the source's read is the innermost.
          const env = scope.has(envKeyOf(entityClass.name)) ? scope.resolve<Env<unknown>>(envKeyOf(entityClass.name)) : undefined;
          const read = env ? await env.read() as Record<string, unknown> | undefined : await values.read(name, entityClass);
          const judged = InputValidator.of(fields).validate(read ?? {});
          if (!judged.success) {
            refusals.push(...judged.errors.map((error) =>
              `${name}.${dotted(error.path)}: ${error.message} — ${values.where(name, entityClass, error.path[0] as string | undefined)}`));
            continue;
          }
          scope.registerValue(upperFirst(name), applyCreate(fields, judged.data));
        }
      }
      if (refusals.length === 0) return;

      throw new BootRefusal(
        `Fougere boot refused: ${refusals.length} value(s) do not hold:\n${refusals.map((line) => `  ${line}`).join('\n')}`,
      );
    },
  };
}
