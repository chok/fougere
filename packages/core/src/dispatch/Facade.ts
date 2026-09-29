import type { Container } from '@fougere/container';
import { type AppMiddleware } from '../wire/AppMiddleware.js';
import type { EffectiveOperationsMap } from '../EffectiveOperationsMap.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { PresenterEntry } from '../descriptor/PresenterEntry.js';
import type { StateShape } from '../wire/StateShape.js';
import type { OwnLogger } from '../builtin/OwnLoggers.js';

/** What boot resolved around one handler, beyond the handler and the scope it resolves in. */
export interface Facade {
  /** The container key this facade answers under. */
  key: string;
  /** The frond this facade belongs to — travels on every OperationContext. */
  frond: string;
  /** Handlers in the owning frond, used to realize a resolved implementation override. */
  handlers: readonly HandlerEntry[];
  /** The canonical operation table resolved before boot performs any side effect. */
  operations: EffectiveOperationsMap;
  /** Entity names this frond has a collector for. */
  collectors: Set<string>;
  /** The presenter over this handler's entity, when the frond declares one. */
  presenter: PresenterEntry | undefined;
  /** Presenters live in the frond's own scope, whatever sub-scope this facade resolves in. */
  presenterScope: Container;
  /** The middlewares that apply to this address, read at call time and never at boot. */
  middlewares: () => AppMiddleware[];
  /** What a call's `state` may hold in this process. */
  state: StateShape;
  /** Runs the handler as the operation a line written inside it names. */
  enterOperation: <R>(label: string, fn: () => Promise<R>) => Promise<R>;
  /** The handler's deps, its `Logger` named after it. */
  ownLogger: OwnLogger;
}
