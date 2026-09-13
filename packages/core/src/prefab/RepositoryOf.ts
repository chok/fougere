import type { Storage } from '../storage/port.js';

/**
 * The shape a repository of ONE entity has — the port itself, plus whatever the subclass names on
 * top.
 */
export type RepositoryOf<T> = Storage<T>;
