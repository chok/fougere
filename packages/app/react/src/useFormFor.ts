'use client';
/**
 * The form contract — state, validation, submission, error mapping. Never a
 * widget: the page owns the rendering, this owns the mechanics.
 *
 * The cycle composes the other primitives: fields from the io axes, local
 * pre-judgment with the same rules the handler enforces (one declaration, both
 * sides), submission through the command (so the entity link revalidates mounted
 * queries), and per-field errors in the same `{ path, message }` shape whoever
 * judged.
 *
 * One visible difference from the Vue composable, and it is React's, not ours:
 * Vue hands back a reactive object a template mutates in place, React state is
 * replaced rather than mutated, so `setValue` is part of the contract here.
 */
import { useCallback, useMemo, useState } from 'react';
import { FougereError, ErrorCode } from '@fougere/core/contract';
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

  /**
   * Judge locally, then send through the command. Returns the created/updated value,
   * or null when a judge (either side) rejected — the errors land per field either
   * way, the form never knows who judged.
   */
  const submit = useCallback(async (): Promise<T | null> => {
    if (!judge()) return null;
    try {
      return await command.execute({ params: options.params, body: payloadOf(values) });
    } catch (err) {
      if (err instanceof FougereError && err.code === ErrorCode.VALIDATION_FAILED && Array.isArray(err.details)) {
        setErrors(errorsByField(err.details as { path: string; message: string }[]));
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
     * The same fields, keyed by name — a form that lays its inputs out by hand binds
     * one at a time (`{...fieldsByName.email.attrs}`) and still states no rule of its
     * own. Without it, a page retypes `type="email"` next to a card that already says
     * `format: 'email'`, and the browser enforces the page rather than the declaration.
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
