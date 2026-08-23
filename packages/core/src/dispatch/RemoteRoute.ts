import { OperationRoute } from './OperationRoute.js';

/** An operation delegated through a remote façade. */
export class RemoteRoute extends OperationRoute {
  readonly kind = 'remote' as const;
}
