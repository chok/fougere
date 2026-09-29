'use client';
/** The form contract — state, validation, submission, error mapping. */
import { useCallback, useMemo, useState } from 'react';
import { validationErrorsOf } from '@fougere/core/contract';
import {
  entityKeyOf,
  errorsByField,
  facadeOf,
  formFieldsOf,
  payloadOf,
  type FormEntity,
  type FormErrors,
  type FormField,
  type FormRow,
  type FormValues,
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

export function useFormFor<E extends FormEntity>(entity: E, options: FormOptions = {}) {
  const entityKey = entityKeyOf(entity);
  const fields = useMemo(() => formFieldsOf(entity, entityKey), [entity, entityKey]);

  // `initial` wins over the declared default: editing a row shows the row, including
  // a value the author deliberately changed away from that default. On a create form
  // there is no `initial`, so the field opens on what is about to be written — the
  // schema's own literal, shown rather than guessed by the page.
  const [values, setValues] = useState<FormValues<E>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, options.initial?.[field.name] ?? field.default])) as FormValues<E>,
  );
  const [errors, setErrors] = useState<FormErrors<E>>({});
  // A form is designated by its ENTITY — it is a set of fields — so the facade it submits to is
  // an address with no handler type behind it, and what it answers is the entity's row.
  const command = useCommand(facadeOf(entity), options.op ?? 'create');

  const setValue = useCallback((name: keyof FormRow<E> & string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  /** Local pre-verdict — same rules as the handler, saves a lost round-trip. */
  const validator = useCallback((): boolean => {
    const result = entity.validate(payloadOf(entity, values));
    setErrors(result.success ? {} : errorsByField<E>(result.errors));

    return result.success;
  }, [entity, values]);

  /** Validate locally, then send through the command. */
  const submit = useCallback(async (): Promise<FormRow<E> | null> => {
    if (!validator()) return null;
    try {
      return (await command.execute({ params: options.params, input: payloadOf(entity, values) })) as FormRow<E>;
    } catch (err) {
      const refusals = validationErrorsOf(err);
      if (refusals) {
        setErrors(errorsByField<E>(refusals));

        return null;
      }
      throw err;
    }
  }, [validator, command, options.params, values]);

  const fieldsByName = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, field])) as Record<string, FormField>,
    [fields],
  );

  return {
    fields,
    /**
     * The same fields, keyed by name — a form that lays its inputs out by hand binds one at a time
     * (`v-bind="fieldsByName.email.attrs"`), and still states no rule of its own.
     */
    fieldsByName,
    values,
    setValue,
    errors,
    submit,
    loading: command.loading,
    /** Non-validation failure of the last submit (unreachable host, conflict…). */
    error: command.error,
    valid: Object.keys(errors).length === 0,
  };
}
