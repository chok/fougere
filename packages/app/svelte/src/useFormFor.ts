/** The form contract — state, validation, submission, error mapping. */
import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import { validationErrorsOf } from '@fougere/core/contract';
import {
  Choices,
  entityKeyOf,
  fetcher,
  facadeOf,
  errorsByField,
  formFieldsOf,
  payloadOf,
  type Choice,
  type SchemaView,
  type FormErrors,
  type FormField,
  type FormFieldName,
  type FormRow,
  type FormValues,
  type FormOptions,
} from '@fougere/app/client';
import { useCommand } from './useFougereData/CommandStore.js';

export type { FormOptions };

export function useFormFor<E extends SchemaView>(entity: E, options: FormOptions = {}) {
  const entityKey = entityKeyOf(entity);
  const fields = formFieldsOf(entity, entityKey);

  // `initial` wins over the declared default: editing a row shows the row. On a
  // create form there is none, so the field opens on what is about to be written.
  const values: Writable<FormValues<E>> = writable(
    Object.fromEntries(fields.map((field) => [field.name, options.initial?.[field.name] ?? field.default])) as FormValues<E>,
  );
  const errors = writable<FormErrors<E>>({});
  // A form is designated by its ENTITY — it is a set of fields — so the facade it submits to is
  // an address with no handler type behind it, and what it answers is the entity's row.
  const command = useCommand(options.to ?? facadeOf(entity), options.op ?? 'create');
  const choices = writable<Partial<Record<FormFieldName<E>, Choice[]>>>({});
  const searchable = writable<Partial<Record<FormFieldName<E>, boolean>>>({});

  /** What a reference field offers: its first rows, or those whose label contains `text`. */
  async function search(name: FormFieldName<E>, text = ''): Promise<void> {
    const reference = fields.find((field) => field.name === name)?.reference;
    if (!reference) return;
    try {
      const offer = await Choices.of(fetcher, reference, text);
      choices.update((current) => ({ ...current, [name]: offer.choices }));
      if (!text) searchable.update((current) => ({ ...current, [name]: offer.more }));
    } catch (refusal) {
      errors.update((current) => ({ ...current, [name]: (refusal as Error).message }));
    }
  }

  if (typeof window !== 'undefined') {
    for (const field of fields) if (field.reference) void search(field.name);
  }

  /** Local pre-verdict — same rules as the handler, saves a lost round-trip. */
  function validator(): boolean {
    const result = entity.validate(payloadOf(entity, get(values)));
    errors.set(result.success ? {} : errorsByField<E>(result.errors));

    return result.success;
  }

  async function submit(): Promise<FormRow<E> | null> {
    if (!validator()) return null;
    const answer = await command.execute({ params: options.params, input: payloadOf(entity, get(values)) });
    const failure = get(command).error;
    const refusals = failure && validationErrorsOf(failure);
    if (refusals) errors.set(errorsByField<E>(refusals));

    return answer as FormRow<E> | null;
  }

  const valid: Readable<boolean> = derived(errors, ($errors) => Object.keys($errors).length === 0);

  return {
    fields,
    /** The same fields, keyed by name — spread `fieldsByName.email.attrs` on an input
     *  and the page states no rule of its own. */
    fieldsByName: Object.fromEntries(fields.map((field) => [field.name, field])) as Partial<Record<FormFieldName<E>, FormField<FormFieldName<E>>>>,
    values,
    errors,
    choices,
    /** Per reference field: its target holds more rows than one load offers, so a search is worth showing. */
    searchable,
    search,
    submit,
    validator,
    valid,
    /** `{ loading, error }` of the underlying command. */
    command,
  };
}
