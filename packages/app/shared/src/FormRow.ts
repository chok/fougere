/** The row an entity class builds, which is what its form fills and what `create` answers. */
export type FormRow<E> = E extends abstract new (...args: never[]) => infer Row ? Row : Record<string, unknown>;

/** What the form holds — any field, none of them yet. */
export type FormValues<E> = Partial<FormRow<E>>;

/** A field of that row, by name. */
export type FormFieldName<E> = keyof FormRow<E> & string;

/** One message per refused field. */
export type FormErrors<E> = Partial<Record<FormFieldName<E>, string>>;
