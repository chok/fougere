import type { Carry } from './Carry.js';

export interface LoggerOptions {
  /** Logger name / prefix. */
  name?: string;
  /**
   * Where its lines go — one boot's, so two apps in a process do not share a facade. A
   * logger without one writes to the console and nowhere else, which is what the boot's
   * first lines do and what an app declaring no destination does forever.
   */
  carry?: Carry;
  /** Force color on/off. Auto-detected by default. */
  color?: boolean;
}
