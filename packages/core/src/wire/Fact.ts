/**
 * What a subscriber accepts — and what it PROMISES about itself.
 *
 * What it ANSWERS is its own to choose: `Promise<void>` says nothing, any other type is an
 * opinion. It reaches an announcer that asked for one — `Emit<CanBook, Verdict>` — and
 * nobody otherwise, since a plain announcement does not wait.
 */
export type Fact<T> = T;
