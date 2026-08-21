/**
 * The form contract — state, validation, submission, error mapping. Never a widget.
 *
 * `values` is a writable store, so a component binds straight into it with
 * `bind:value={$form.values[field.name]}`. That is the Svelte equivalent of Vue's
 * reactive object and of React's `setValue`: the same contract, three ways of
 * holding a value, none of which is a rule.
 */
import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import { validationErrorsOf } from '@fougere/core/contract';
import {
  entityKeyOf,
  errorsByField,
  formFieldsOf,
  payloadOf,
  type EntityClass,
  type FormEntity,
  type FormField,
} from '@fougere/app/client';
import { useCommand } from './useFougereData.js';

export interface FormOptions {
  /** Command the submit rides. Default: 'create'. */
  op?: string;
  /** Initial values (edit mode: the loaded entity). */
  initial?: Record<string, unknown>;
  /** Call params designating the target (edit mode: { id }). */
  params?: Record<string, string>;
}

export function useFormFor<T = Record<string, unknown>>(entity: FormEntity, options: FormOptions = {}) {
  const entityKey = entityKeyOf(entity);
  const fields: FormField[] = formFieldsOf(entity, entityKey);

  // `initial` wins over the declared default: editing a row shows the row. On a
  // create form there is none, so the field opens on what is about to be written.
  const values: Writable<Record<string, unknown>> = writable(
    Object.fromEntries(fields.map((field) => [field.name, options.initial?.[field.name] ?? field.default])),
  );
  const errors = writable<Record<string, string>>({});
  const command = useCommand<T>(entity as EntityClass, options.op ?? 'create');

  /** Local pre-judgment — same rules as the handler, saves a lost round-trip. */
  function judge(): boolean {
    const result = entity.validate(payloadOf(get(values)));
    errors.set(result.success ? {} : errorsByField(result.errors));
    return result.success;
  }

  async function submit(): Promise<T | null> {
    if (!judge()) return null;
    try {
      return await command.execute({ params: options.params, body: payloadOf(get(values)) });
    } catch (err) {
      const refusals = validationErrorsOf(err);
      if (refusals) {
        errors.set(errorsByField(refusals));
        return null;
      }
      throw err;
    }
  }

  const valid: Readable<boolean> = derived(errors, ($errors) => Object.keys($errors).length === 0);

  return {
    fields,
    /** The same fields, keyed by name — spread `fieldsByName.email.attrs` on an input
     *  and the page states no rule of its own. */
    fieldsByName: Object.fromEntries(fields.map((field) => [field.name, field])) as Record<string, FormField>,
    values,
    errors,
    submit,
    judge,
    valid,
    /** `{ loading, error }` of the underlying command. */
    command,
  };
}
