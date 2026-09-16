/** Holds nothing, says nothing — built per consumer, closed by nobody. */
export default class Clock {
  static opened = 0;

  constructor() { Clock.opened += 1; }
}
