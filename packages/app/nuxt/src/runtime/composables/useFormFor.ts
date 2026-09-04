/** The form contract — state, validation, submission, error mapping. */
import { reactive, computed } from 'vue';
import { lowerFirst, validationErrorsOf } from '@fougere/core/contract';
import { useCommand } from './useFougereData.js';
import { formFieldsOf, payloadOf, errorsByField, type FormEntity, type FormField } from '@fougere/app/client';

export interface FormOptions {
  /** Command the submit rides. Default: 'create'. */
  op?: string;
  /** Initial values (edit mode: the loaded entity). */
  initial?: Record<string, unknown>;
  /** Call params designating the target (edit mode: { id }). */
  params?: Record<string, string>;
}

export function useFormFor<T = Record<string, unknown>>(entity: FormEntity, options: FormOptions = {}) {
  const entityKey = lowerFirst(entity.name);
  const fields: FormField[] = formFieldsOf(entity, entityKey);

  // `initial` wins over the declared default: editing a row shows the row, including a
  // value the author deliberately changed away from that default. On a create form
  // there is no `initial`, so the field opens on what is about to be written — the
  // schema's own literal, shown rather than guessed by the page.
  const values = reactive<Record<string, unknown>>(
    Object.fromEntries(fields.map((f) => [f.name, options.initial?.[f.name] ?? f.default])),
  );
  const errors = reactive<Record<string, string>>({});
  const command = useCommand<T>(entity, options.op ?? 'create');

  function clearErrors() {
    for (const key of Object.keys(errors)) delete errors[key];
  }

  /** Local pre-judgment — same rules as the handler, saves a lost round-trip. */
  function judge(): boolean {
    clearErrors();
    const result = entity.validate(payloadOf(values));
    if (result.success) return true;
    Object.assign(errors, errorsByField(result.errors));
    return false;
  }

  /** Judge locally, then send through the command. */
  async function submit(): Promise<T | null> {
    if (!judge()) return null;
    try {
      return await command.execute({ params: options.params, body: payloadOf(values) });
    } catch (err) {
      const refusals = validationErrorsOf(err);
      if (refusals) {
        Object.assign(errors, errorsByField(refusals));
        return null;
      }
      throw err;
    }
  }

  return {
    fields,
    /** The same fields, keyed by name — a form that lays its inputs out by hand binds one at a time (`v… */
    fieldsByName: Object.fromEntries(fields.map((f) => [f.name, f])) as Record<string, FormField>,
    values,
    errors,
    submit,
    loading: command.loading,
    /** Non-validation failure of the last submit (unreachable host, conflict…). */
    error: command.error,
    valid: computed(() => Object.keys(errors).length === 0),
  };
}
