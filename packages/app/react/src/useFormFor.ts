'use client';
/** The form contract — state, validation, submission, error mapping. */
import { useCallback, useMemo, useState } from 'react';
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
  const fields = useMemo(() => formFieldsOf(entity, entityKey), [entity, entityKey]);

  // `initial` wins over the declared default: editing a row shows the row, including
  // a value the author deliberately changed away from that default. On a create form
  // there is no `initial`, so the field opens on what is about to be written — the
  // schema's own literal, shown rather than guessed by the page.
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, options.initial?.[field.name] ?? field.default])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const command = useCommand<T>(entity as EntityClass, options.op ?? 'create');

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  /** Local pre-judgment — same rules as the handler, saves a lost round-trip. */
  const judge = useCallback((): boolean => {
    const result = entity.validate(payloadOf(values));
    setErrors(result.success ? {} : errorsByField(result.errors));
    return result.success;
  }, [entity, values]);

  /** Judge locally, then send through the command. */
  const submit = useCallback(async (): Promise<T | null> => {
    if (!judge()) return null;
    try {
      return await command.execute({ params: options.params, body: payloadOf(values) });
    } catch (err) {
      const refusals = validationErrorsOf(err);
      if (refusals) {
        setErrors(errorsByField(refusals));
        return null;
      }
      throw err;
    }
  }, [judge, command, options.params, values]);

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
