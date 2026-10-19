import type { DispatchEvent } from './DispatchEvent.js';
import type { DoorEvent } from './DoorEvent.js';

/** Sees every call, and every request at a door that the calls were made within. */
export type DispatchObserver = (event: DispatchEvent | DoorEvent) => void;
