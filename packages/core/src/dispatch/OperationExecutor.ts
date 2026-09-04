import type { InvocationContext } from '../contract/Invocation.js';
import { canonicalInvocation } from '../contract/Invocation.js';
import type { OperationContract } from '../wire/operation.js';
import {
  runMiddlewares,
  type AppMiddleware,
  type OperationContext,
} from '../wire/middleware.js';
import type { ArgumentResolver } from './ArgumentResolver.js';
import type { OutputView } from './OutputView.js';
import { validateInput } from './validateInput.js';

export interface OperationExecution {
  entity: string;
  frond: string;
  operation: string;
  contract: OperationContract | undefined;
  middlewares: () => AppMiddleware[];
  arguments: ArgumentResolver;
  invoke: (args: unknown[]) => unknown | Promise<unknown>;
  view: OutputView;
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
    return runMiddlewares(this.execution.middlewares(), context, async () => {
      const effective = validateInput(
        this.execution.contract?.input,
        invocation,
        context.entity,
        context.operation,
      );
      context.invocation = effective;

      const args = this.execution.contract?.binding
        ? await this.execution.arguments.resolve(this.execution.contract.binding, effective)
        : [];
      const projected = this.execution.view.project(
        await this.execution.invoke(args),
      );
      return this.execution.present
        ? this.execution.present(projected, effective)
        : projected;
    });
  }
}
