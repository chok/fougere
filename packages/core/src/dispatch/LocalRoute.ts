import { OperationRoute } from './OperationRoute.js';

/** An operation executed by this application process. */
export class LocalRoute extends OperationRoute {
  readonly kind = 'local' as const;
}
