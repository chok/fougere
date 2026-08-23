import { OperationRoute } from './OperationRoute.js';

/** An application-level operation such as rpc.discover. */
export class SystemRoute extends OperationRoute {
  readonly kind = 'system' as const;
}
