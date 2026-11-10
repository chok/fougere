import { Page } from '../wire/Page.js';
import { upperFirst, type Fields } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { runMiddlewares } from '../wire/AppMiddleware.js';
import { type OperationContext } from '../wire/OperationContext.js';
import { isRepository, seatOf } from '../prefab/Repository.js';
import type { OperationContract } from '../wire/OperationContract.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import type { EffectiveOperation } from '../operation/EffectiveOperation.js';
import type { EffectiveOperationsMap } from '../operation/EffectiveOperationsMap.js';
import { Invocation } from '../wire/Invocation.js';
import { type InvocationContext } from '../wire/InvocationContext.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import { ArgumentResolver } from './ArgumentResolver.js';
import { OutputView } from './OutputView.js';
import { validateInput } from './validateInput.js';
import { FougereError } from '../wire/FougereError.js';
import type { Facade } from './Facade.js';

/** Adapts one handler facade to executable operations. */
export class HandlerFacade {
  /** Rich operation facts shared with check, explain and adapters. */
  readonly effectiveOperations: EffectiveOperationsMap;
  /** Contracts served by this facade. */
  readonly contracts: OperationsMap;

  private readonly cachedViews = new Map<string, OutputView>();
  private instance: any;
  private readonly implementationKeys = new Map<string, string>();
  private readonly implementationInstances = new Map<string, any>();
  private readonly arguments: ArgumentResolver;

  constructor(
    private readonly handler: HandlerEntry,
    private readonly scope: Container,
    private readonly facade: Facade,
  ) {
    this.refuseUnseated(handler);
    this.arguments = new ArgumentResolver(scope, facade.entities);

    scope.register(this.handlerKey, handler.ctor, { deps: this.depsOf(handler), lifetime: 'singleton' });

    this.effectiveOperations = facade.operations;
    this.contracts = new Map(
      [...facade.operations].map(([name, operation]) => [name, operation as OperationContract] as const),
    );
    handler.operations = this.contracts;

    for (const [name, operation] of facade.operations) {
      if (this.isBaseImplementation(operation)) continue;
      const implementation = this.implementationHandler(name);
      this.refuseUnseated(implementation);
      const key = `${this.handlerKey}:implementation:${operation.implementation.className}`;
      if (!this.implementationKeys.has(operation.implementation.className)) {
        scope.register(key, implementation.ctor, { deps: this.depsOf(implementation) });
        this.implementationKeys.set(operation.implementation.className, key);
      }
    }
  }

  /** One operation, through the same ordered boundary steps on every route. */
  async execute(op: string, input?: Partial<InvocationContext>): Promise<unknown> {
    const address = this.handler.address;
    const contract = this.contracts.get(op);
    if (!contract) {
      throw new Error(
        `${address} serves no operation '${op}'. `
        + `It serves ${[...this.contracts.keys()].join(', ')}.`,
      );
    }

    const received = Invocation.from(input);
    const state = received.fromAnotherProcess ? { ...received.state } : this.facade.state.judge(received.state, address, op);
    const invocation = received.withState(state);
    const entered = { ...state };
    const { className, method } = this.effectiveOperations.get(op)!.implementation;
    const context: OperationContext = {
      address,
      frond: this.facade.frond,
      handler: className,
      operation: op,
      args: [],
      state: invocation.state,
      invocation,
    };

    const label = `${this.facade.frond}:${className}.${method}`;
    const addressed = (error: unknown): never => { throw error instanceof FougereError ? error.at(address, op) : error; };

    return runMiddlewares(this.facade.middlewares(), context, () =>
      this.facade.enterOperation(label, () => this.answer(op, contract, context, invocation, entered)).catch(addressed))
      .catch(addressed);
  }

  private async answer(
    op: string,
    contract: OperationContract,
    context: OperationContext,
    invocation: Invocation,
    entered: Record<string, unknown>,
  ): Promise<unknown> {
    const state = this.facade.state.judge(context.state, this.handler.address, op, entered);
    const written = invocation.args !== undefined;
    const validated = written ? { ...invocation, state } : validateInput(contract.input, { ...invocation, state });
    context.invocation = validated;

    const args = await this.argumentsOf(contract, validated);
    const { instance, method } = this.resolveImplementation(op);
    const returned = await instance[method](...args);
    const answer = contract.cardinality === 'page' && Array.isArray(returned) ? Page.of(returned) : returned;

    const view = this.viewOf(op);
    const computed = written || view.closed || this.facade.steps.length === 0 ? answer : await this.stepped(answer, validated);

    return view.project(computed);
  }

  private async argumentsOf(contract: OperationContract, invocation: InvocationContext): Promise<unknown[]> {
    if (!contract.binding) return [];
    if (invocation.args !== undefined) return this.arguments.given(contract.binding, contract.input, invocation);

    return this.arguments.resolve(contract.binding, invocation, contract.output);
  }

  private async stepped(answer: unknown, invocation: InvocationContext): Promise<unknown> {
    let value = answer;
    for (const step of this.facade.steps) value = await step(value, invocation, this.arguments);

    return value;
  }

  private get handlerKey(): string {
    return this.handler.name;
  }

  private depsOf(handler: HandlerEntry): string[] {
    return handler.deps.length > 0 ? this.facade.ownLogger(handler.ctor.name, handler.deps) : [];
  }

  private refuseUnseated(handler: HandlerEntry): void {
    if (!isRepository(handler.ctor) || seatOf(handler.ctor).length > 0) return;
    throw new Error(
      `${handler.ctor.name} extends Repository, and nothing says which entity: TypeScript erases its type argument. `
      + `A frond written by hand states it — { ctor: ${handler.ctor.name}, repository: ${upperFirst(handler.address)} }.`,
    );
  }

  private viewOf(op: string): OutputView {
    const known = this.cachedViews.get(op);
    if (known) return known;

    const operation = this.effectiveOperations.get(op);
    const schema = operation?.output as { getFields?: () => Fields } | undefined;
    const resolved = new OutputView(
      typeof schema?.getFields === 'function' ? schema.getFields() : {},
      operation?.outputClosed ?? false,
    );
    this.cachedViews.set(op, resolved);

    return resolved;
  }

  private resolveHandler(): any {
    if (!this.instance) this.instance = this.scope.resolve(this.handlerKey);

    return this.instance;
  }

  private isBaseImplementation(operation: EffectiveOperation): boolean {
    return operation.implementation.className === this.handler.ctor.name
      && operation.implementation.address === this.handler.address
      && operation.implementation.filePath === this.handler.filePath;
  }

  private implementationHandler(operationName: string): HandlerEntry {
    const operation = this.effectiveOperations.get(operationName)!;
    const matches = this.facade.handlers.filter((handler) =>
      handler.ctor.name === operation.implementation.className
      && handler.address === operation.implementation.address
      && handler.filePath === operation.implementation.filePath);
    if (matches.length !== 1) {
      throw new Error(
        `EffectiveOperation '${operation.id}' names ${operation.implementation.className}.`
        + `${operation.implementation.method}, but boot found ${matches.length} matching handlers.`,
      );
    }

    return matches[0]!;
  }

  private resolveImplementation(operationName: string): { instance: any; method: string } {
    const operation = this.effectiveOperations.get(operationName)!;
    if (this.isBaseImplementation(operation)) {
      return { instance: this.resolveHandler(), method: operation.implementation.method };
    }

    const className = operation.implementation.className;
    const key = this.implementationKeys.get(className);
    if (!key) throw new Error(`No registered implementation for EffectiveOperation '${operation.id}'.`);
    let instance = this.implementationInstances.get(key);
    if (!instance) {
      instance = this.scope.resolve(key);
      this.implementationInstances.set(key, instance);
    }

    return { instance, method: operation.implementation.method };
  }
}
