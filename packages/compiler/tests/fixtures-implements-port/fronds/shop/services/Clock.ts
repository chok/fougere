export interface Ticking {
  now(): number;
}

/** Implements an INTERFACE — the ordinary case, and no finding is due. */
export default class Clock implements Ticking {
  now(): number { return 0; }
}
