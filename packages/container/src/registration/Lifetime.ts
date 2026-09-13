/**
 * `'singleton'` builds once per scope and the container disposes it; `'transient'`
 * builds per `resolve` and the caller closes it. Absent means `'transient'`.
 */
export type Lifetime = 'singleton' | 'transient';
