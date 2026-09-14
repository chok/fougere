import { type SampleOptions } from './sample.js';

export interface DoorOptions extends SampleOptions {
  given?: Record<string, unknown>;
  /** The audience, when the app serves named surfaces. */
  surface?: string;
}
