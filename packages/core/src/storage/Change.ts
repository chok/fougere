/** A row computed from the one it replaces, while no other write reaches that row. */
export type Change<T> = (current: T) => Partial<T> | Promise<Partial<T>>;

export const isChange = <T>(input: Partial<T> | Change<T>): input is Change<T> =>
  typeof input === 'function';
