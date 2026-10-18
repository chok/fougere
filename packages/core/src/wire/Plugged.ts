/**
 * What answers one extension point in this app — a registry's names, a port's chain, the order a
 * frond's middlewares stand in, the extensions that step over a facade's answers. A report: it
 * describes what booted and drives nothing.
 */
export interface Plugged {
  /** The question — `source type`, `Payment`, `middleware`, `answer step`. */
  point: string;
  /** Answered by NAME (a registry) or by TYPE (a class that extends). */
  by: 'name' | 'type';
  /** Where it was answered, for a point a frond answers on its own. */
  frond?: string;
  /** What it is about, when the point is asked of one thing — the facade a step runs over. */
  subject?: string;
  /** Who answers, outside in where the order matters. */
  answers: string[];
}
