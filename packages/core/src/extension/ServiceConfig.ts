import type { FougereServices } from './FougereServices.js';

/** One entry of `services:` — what its type admits. */
export type ServiceConfig = FougereServices[keyof FougereServices];

/** What every entry of `services:` states, whatever its type. */
export interface ServiceBase {
  type: string;
  port: number;
  scheme?: string;
  health?: string;
}
