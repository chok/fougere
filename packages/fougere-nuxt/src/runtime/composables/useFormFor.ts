/**
 * The form contract — state, validation, submission, error mapping.
 * Never a widget: the page owns the rendering, this owns the mechanics.
 *
 * The cycle composes the other primitives: fields from the io axes,
 * local pre-judgment with the same rules the handler enforces (one
 * declaration, both sides), submission through the command (so the
 * entity link revalidates mounted queries), and per-field errors in
 * the same `{ path, message }` shape whoever judged.
 */
import { reactive, computed } from 'vue';
import { FougereError, ErrorCode, toRegistrationName } from '@fougere/core/contract';
import { useCommand } from './useFougereData.js';
import { formFieldsOf, payloadOf, errorsByField, type FormEntity, type FormField } from '../form/fields.js';

export interface FormOptions {
  /** Command the submit rides. Default: 'create'. */
  op?: string;
  /** Initial values (edit mode: the loaded entity). */
  initial?: Record<string, unknown>;
  /** Call params designating the target (edit mode: { id }). */
  params?: Record<string, string>;
}

export function useFormFor<T = Record<string, unknown>>(entity: FormEntity, options: FormOptions = {}) {
  const entityKey = toRegistrationName(entity.name);
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

  /**
   * Judge locally, then send through the command. Returns the created/updated
   * value, or null when a judge (either side) rejected — the errors land per
   * field either way, the form never knows who judged.
   */
  async function submit(): Promise<T | null> {
    if (!judge()) return null;
    try {
      return await command.execute({ params: options.params, body: payloadOf(values) });
    } catch (err) {
      if (err instanceof FougereError && err.code === ErrorCode.VALIDATION_FAILED && Array.isArray(err.details)) {
        Object.assign(errors, errorsByField(err.details as { path: string; message: string }[]));
        return null;
      }
      throw err;
    }
  }

  return {
    fields,
    /**
     * The same fields, keyed by name — a form that lays its inputs out by hand binds
     * one at a time (`v-bind="fieldsByName.email.attrs"`), and still states no rule of
     * its own. Without it, a page retypes `type="email"` next to a card that says
     * `format: 'email'`, and the browser enforces the page rather than the declaration.
     */
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
