/** The form contract — state, validation, submission, error mapping. */
import { reactive, computed, onMounted } from 'vue';
import { useRequestFetch } from '#imports';
import { lowerFirst, validationErrorsOf } from '@fougere/core/contract';
import { useCommand } from './useFougereData.js';
import { Choices, facadeOf, formFieldsOf, payloadOf, errorsByField, type Choice, type Fetcher, type FormEntity, type FormField, type FormErrors, type FormFieldName, type FormRow, type FormValues, type FormOptions } from '@fougere/app/client';

export type { FormOptions };

export function useFormFor<E extends FormEntity>(entity: E, options: FormOptions = {}) {
  const entityKey = lowerFirst(entity.name);
  const fields = formFieldsOf(entity, entityKey);

  // `initial` wins over the declared default: editing a row shows the row, including a
  // value the author deliberately changed away from that default. On a create form
  // there is no `initial`, so the field opens on what is about to be written — the
  // schema's own literal, shown rather than guessed by the page.
  const values = reactive<Record<string, unknown>>(
    Object.fromEntries(fields.map((f) => [f.name, options.initial?.[f.name] ?? f.default])),
  );
  const errors = reactive<Record<string, string>>({});
  // A form is designated by its ENTITY — it is a set of fields — so the facade it submits to is
  // an address with no handler type behind it, and what it answers is the entity's row.
  const command = useCommand(options.to ?? facadeOf(entity), options.op ?? 'create');
  const fetcher = useRequestFetch() as Fetcher;
  const choices = reactive<Record<string, Choice[]>>({});
  const searchable = reactive<Record<string, boolean>>({});

  /** What a reference field offers: its first rows, or those whose label contains `text`. */
  async function search(name: FormFieldName<E>, text = ''): Promise<void> {
    const reference = fields.find((field) => field.name === name)?.reference;
    if (!reference) return;
    try {
      const offer = await Choices.of(fetcher, reference, text);
      choices[name] = offer.choices;
      if (!text) searchable[name] = offer.more;
    } catch (refusal) {
      errors[name] = (refusal as Error).message;
    }
  }

  onMounted(() => {
    for (const field of fields) if (field.reference) void search(field.name);
  });

  function clearErrors() {
    for (const key of Object.keys(errors)) delete errors[key];
  }

  /** Local pre-verdict — same rules as the handler, saves a lost round-trip. */
  function validator(): boolean {
    clearErrors();
    const result = entity.validate(payloadOf(entity, values));
    if (result.success) return true;
    Object.assign(errors, errorsByField<E>(result.errors));

    return false;
  }

  /** Validate locally, then send through the command. */
  async function submit(): Promise<FormRow<E> | null> {
    if (!validator()) return null;
    const answer = await command.execute({ params: options.params, input: payloadOf(entity, values) });
    const refusals = command.error.value && validationErrorsOf(command.error.value);
    if (refusals) Object.assign(errors, errorsByField<E>(refusals));

    return answer as FormRow<E> | null;
  }

  return {
    fields,
    /**
     * The same fields, keyed by name — a form that lays its inputs out by hand binds one at a time
     * (`v-bind="fieldsByName.email.attrs"`), and still states no rule of its own.
     */
    fieldsByName: Object.fromEntries(fields.map((f) => [f.name, f])) as Partial<Record<FormFieldName<E>, FormField<FormFieldName<E>>>>,
    values: values as FormValues<E>,
    errors: errors as FormErrors<E>,
    choices: choices as Partial<Record<FormFieldName<E>, Choice[]>>,
    /** Per reference field: its target holds more rows than one load offers, so a search is worth showing. */
    searchable: searchable as Partial<Record<FormFieldName<E>, boolean>>,
    search,
    submit,
    loading: command.loading,
    /** Non-validation failure of the last submit (unreachable host, conflict…). */
    error: command.error,
    valid: computed(() => Object.keys(errors).length === 0),
  };
}
