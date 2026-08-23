import type { InFlight } from '../boot/inflight.js';
import type { InvocationContext } from '../contract/Invocation.js';
import { canonicalInvocation } from '../contract/Invocation.js';
import type { OperationContract } from '../wire/operation.js';
import {
  runMiddlewares,
  type AppMiddleware,
  type OperationContext,
} from '../wire/middleware.js';
import type { ArgumentResolver } from './ArgumentResolver.js';
import type { InputValidator } from './InputValidator.js';
import type { OutputProjector } from './OutputProjector.js';

export interface OperationExecution {
  entity: string;
  frond: string;
  operation: string;
  contract: OperationContract | undefined;
  middlewares: () => AppMiddleware[];
  inFlight: InFlight;
  validator: InputValidator;
  arguments: ArgumentResolver;
  invoke: (args: unknown[]) => unknown | Promise<unknown>;
  projector: OutputProjector;
  present?: (result: unknown, invocation: InvocationContext) => Promise<unknown>;
}

/** Executes one operation through the same ordered boundary steps on every route. */
export class OperationExecutor {
  constructor(private readonly execution: OperationExecution) {}

  async execute(input?: Partial<InvocationContext>): Promise<unknown> {
    const invocation = canonicalInvocation(input);
    const context: OperationContext = {
      entity: this.execution.entity,
      frond: this.execution.frond,
      operation: this.execution.operation,
      args: [],
      state: invocation.state,
      invocation,
    };
    const done = this.execution.inFlight.enter(context.entity, context.operation);

    try {
      return await runMiddlewares(this.execution.middlewares(), context, async () => {
        const effective = this.execution.validator.validate(
          this.execution.contract?.input,
          invocation,
          context.entity,
          context.operation,
        );
        context.invocation = effective;

        const args = this.execution.contract?.binding
          ? await this.execution.arguments.resolve(this.execution.contract.binding, effective)
          : [];
        const projected = this.execution.projector.project(
          await this.execution.invoke(args),
        );
        return this.execution.present
          ? this.execution.present(projected, effective)
          : projected;
      });
    } finally {
      done();
    }
  }
}
