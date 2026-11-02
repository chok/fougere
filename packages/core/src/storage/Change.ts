/**
 * A row computed from the one it replaces. Handed to `update`, it runs while no other write can
 * reach that row, so what it read is still what the row holds when its answer lands.
 */
export type Change<T> = (current: T) => Partial<T> | Promise<Partial<T>>;

export const isChange = <T>(input: Partial<T> | Change<T>): input is Change<T> =>
  typeof input === 'function';
