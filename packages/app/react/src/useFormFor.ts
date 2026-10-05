'use client';
/** The form contract — state, validation, submission, error mapping. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { validationErrorsOf } from '@fougere/core/contract';
import {
  Choices,
  entityKeyOf,
  errorsByField,
  facadeOf,
  formFieldsOf,
  openingOf,
  payloadOf,
  type Choice,
  type FormEntity,
  type FormErrors,
  type FormField,
  type FormFieldName,
  type FormRow,
  type FormValues,
  type FormOptions,
} from '@fougere/app/client';
import { useCommand } from './useFougereData.js';
import { fetcher } from './transport.js';

export type { FormOptions };

export function useFormFor<E extends FormEntity>(entity: E, options: FormOptions = {}) {
  const entityKey = entityKeyOf(entity);
  const fields = useMemo(() => formFieldsOf(entity, entityKey), [entity, entityKey]);

  const [values, setValues] = useState<FormValues<E>>(() => openingOf(fields, options.initial) as FormValues<E>);
  const [errors, setErrors] = useState<FormErrors<E>>({});
  // A form is designated by its ENTITY — it is a set of fields — so the facade it submits to is
  // an address with no handler type behind it, and what it answers is the entity's row.
  const command = useCommand(options.to ?? facadeOf(entity), options.op ?? 'create');
  const [choices, setChoices] = useState<Partial<Record<FormFieldName<E>, Choice[]>>>({});
  const [searchable, setSearchable] = useState<Partial<Record<FormFieldName<E>, boolean>>>({});

  /** What a reference field offers: its first rows, or those whose label contains `text`. */
  const search = useCallback(async (name: FormFieldName<E>, text = '') => {
    const reference = fields.find((field) => field.name === name)?.reference;
    if (!reference) return;
    try {
      const offer = await Choices.of(fetcher, reference, text);
      setChoices((current) => ({ ...current, [name]: offer.choices }));
      if (!text) setSearchable((current) => ({ ...current, [name]: offer.more }));
    } catch (refusal) {
      setErrors((current) => ({ ...current, [name]: (refusal as Error).message }));
    }
  }, [fields]);

  useEffect(() => {
    for (const field of fields) if (field.reference) void search(field.name);
  }, [fields, search]);

  const setValue = useCallback((name: FormFieldName<E>, value: unknown) => {
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
    const answer = await command.execute({ params: options.params, input: payloadOf(entity, values) });
    if (answer !== null && !options.initial) setValues(openingOf(fields) as FormValues<E>);

    return answer as FormRow<E> | null;
  }, [validator, command, options.params, options.initial, fields, values]);

  // What the server refused lands per field too, read off the command's own state: its `execute` resolves
  // before React has rendered the refusal, so it cannot be handed over at the call.
  const refusals = command.error ? validationErrorsOf(command.error) : undefined;
  const shown = Object.keys(errors).length === 0 && refusals ? errorsByField<E>(refusals) : errors;

  const fieldsByName = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, field])) as Partial<Record<FormFieldName<E>, FormField<FormFieldName<E>>>>,
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
    errors: shown,
    choices,
    /** Per reference field: its target holds more rows than one load offers, so a search is worth showing. */
    searchable,
    search,
    submit,
    loading: command.loading,
    /** Non-validation failure of the last submit (unreachable host, conflict…). */
    error: command.error,
    valid: Object.keys(shown).length === 0,
  };
}
