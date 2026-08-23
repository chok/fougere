import type { Call } from '../contract/Call.js';
import type { RouteKind } from './Route.js';

export type DispatchEvent =
  | { readonly stage: 'received'; readonly call: Call }
  | { readonly stage: 'resolved'; readonly call: Call; readonly routeKind: RouteKind }
  | { readonly stage: 'completed'; readonly call: Call; readonly routeKind: RouteKind }
  | {
      readonly stage: 'failed';
      readonly call: Call;
      readonly routeKind?: RouteKind;
      readonly error: unknown;
    }
  | {
      readonly stage: 'settled';
      readonly call: Call;
      readonly routeKind?: RouteKind;
    };

export type DispatchObserver = (event: DispatchEvent) => void;
