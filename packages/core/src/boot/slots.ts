import { ambient as realized } from '#ambient';
import type { Ambient } from './ambient-port.js';
import type { DoorRequest } from '../wire/DoorRequest.js';

/** The context this runtime realizes — published under its port, since `#ambient` resolves only inside core. */
export const ambient: Ambient = realized;

/** The operation the code runs inside — `blog:PostHandler.publish` — what a log line says it was written during. */
export const operation = ambient.slot<string>('operation');

/** The request at a door every call it makes answers within. */
export const request = ambient.slot<DoorRequest>('request');
