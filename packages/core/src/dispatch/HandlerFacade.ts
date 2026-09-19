import type { Fields } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { runMiddlewares } from '../wire/AppMiddleware.js';
import { type OperationContext } from '../wire/OperationContext.js';
import type { CollectorResolver } from './CollectorResolver.js';
import { collectorKeyOf } from '../prefab/collector.js';
import { inheritsCrud, subjectOf } from '../prefab/CrudConstructor.js';
import { presenterKeyOf } from '../prefab/presenter.js';
import { repositoryKeyOf } from '../prefab/RepositoryConstructor.js';
import type { OperationContract } from '../wire/OperationContract.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import type { EffectiveOperation } from '../EffectiveOperation.js';
import type { EffectiveOperationsMap } from '../EffectiveOperationsMap.js';
import type { BindingPlan } from '../wire/binding.js';
import { Invocation } from '../wire/Invocation.js';
import { type InvocationContext } from '../wire/InvocationContext.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { PresenterEntry } from '../descriptor/PresenterEntry.js';
import { ArgumentResolver } from './ArgumentResolver.js';
import { OutputView } from './OutputView.js';
import { PresenterExecutor } from './PresenterExecutor.js';
import { presenterArguments, presenterPlans } from './presenterArguments.js';
import { validateInput } from './validateInput.js';
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
  private readonly arguments = new ArgumentResolver(
    (typeName) => this.collectorResolver(typeName),
  );
  /** A computed field's parameters and the collectors in scope are both boot-time facts. */
  private readonly presenterPlans: Map<string, BindingPlan>;

  private collectorResolver = (typeName: string): CollectorResolver | undefined => {
    try { return this.scope.resolve(collectorKeyOf(typeName)) as CollectorResolver; }
    catch { return undefined; }
  };

  constructor(
    private readonly handler: HandlerEntry,
    private readonly scope: Container,
    private readonly facade: Facade,
  ) {
    this.refuseCrudWithoutRepository(handler);

    this.presenterPlans = facade.presenter
      ? presenterPlans(facade.presenter, facade.collectors)
      : new Map();

    scope.register(this.handlerKey, handler.ctor, { deps: this.depsOf(handler) });

    this.effectiveOperations = facade.operations;
    this.contracts = new Map(
      [...facade.operations].map(([name, operation]) => [name, operation as OperationContract] as const),
    );
    handler.operations = this.contracts;

    // Register model-selected implementations in the same execution scope.
    for (const [name, operation] of facade.operations) {
      if (this.isBaseImplementation(operation)) continue;
      const implementation = this.implementationHandler(name);
      this.refuseCrudWithoutRepository(implementation);
      const key = `${this.handlerKey}:implementation:${operation.implementation.className}`;
      if (!this.implementationKeys.has(operation.implementation.className)) {
        scope.register(key, implementation.ctor, { deps: this.depsOf(implementation) });
        this.implementationKeys.set(operation.implementation.className, key);
      }
    }
  }

  /** One operation, through the same ordered boundary steps on every route. */
  async execute(op: string, input?: Partial<InvocationContext>): Promise<unknown> {
    const entity = this.handler.address;
    const contract = this.contracts.get(op);
    if (!contract) {
      throw new Error(
        `${entity} serves no operation '${op}'. `
        + `It serves ${[...this.contracts.keys()].join(', ')}.`,
      );
    }

    const invocation = Invocation.from(input);
    const context: OperationContext = {
      entity,
      frond: this.facade.frond,
      operation: op,
      args: [],
      state: invocation.state,
      invocation,
    };

    return runMiddlewares(this.facade.middlewares(), context, () => this.answer(op, contract, context, invocation));
  }

  /**
   * What the handler answers, once the middlewares let the call through: the input judged, the
   * arguments bound, the row projected onto the view this audience sees.
   */
  private async answer(
    op: string,
    contract: OperationContract,
    context: OperationContext,
    invocation: Invocation,
  ): Promise<unknown> {
    const validated = validateInput(contract.input, invocation, this.handler.address, op);
    context.invocation = validated;

    const args = contract.binding ? await this.arguments.resolve(contract.binding, validated) : [];
    const { instance, method } = this.resolveImplementation(op);
    const answered = await instance[method](...args);

    const view = this.viewOf(op);
    const { presenter } = this.facade;
    const computed = view.closed || !presenter
      ? answered
      : await this.present(op, presenter, answered, validated);

    return view.project(computed);
  }

  /**
   * The computed fields a presenter adds, over the rows the handler answered and BEFORE the
   * view projects them. A presenter runs on the server, so what it reads is the row the
   * storage holds: a `writeOnly` field is gone by the time the client sees it, and deriving
   * from one is the whole reason to declare it.
   */
  private present(
    op: string,
    presenter: PresenterEntry,
    output: unknown,
    invocation: InvocationContext,
  ): Promise<unknown> {
    const entity = this.handler.address;
    const executor = new PresenterExecutor(
      this.facade.presenterScope.resolve(presenterKeyOf(entity)),
      presenter.fields,
      entity,
      op,
    );

    return presenterArguments(this.presenterPlans, invocation, this.arguments)
      .then((args) => executor.present(output, args));
  }

  private get handlerKey(): string {
    return `_handler:${this.facade.key}`;
  }

  private depsOf(handler: HandlerEntry): string[] {
    const { deps } = handler;
    if (deps.length > 0) return deps;

    return inheritsCrud(handler.ctor)
      ? [repositoryKeyOf(subjectOf(handler.ctor, handler.address))]
      : [];
  }

  /** A custom Crud constructor must explicitly receive its repository. */
  private refuseCrudWithoutRepository(handler: HandlerEntry): void {
    const repoTypeName = repositoryKeyOf(subjectOf(handler.ctor, handler.address));
    if (!inheritsCrud(handler.ctor) || handler.deps.length === 0 || handler.deps.includes(repoTypeName)) return;
    throw new Error(
      `${handler.ctor.name} extends Crud() and declares a constructor, so its storage is no ` +
      `longer injected for it — but it does not take any.\n` +
      `  Add it and hand it to super():\n` +
      `    constructor(repo: ${repoTypeName}, …) { super(repo); }`,
    );
  }

  /** Resolve and cache the output view declared for one operation. */
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

  /** The handler itself, resolved on first call — never at boot. */
  private resolveHandler(): any {
    if (!this.instance) this.instance = this.scope.resolve(this.handlerKey);

    return this.instance;
  }

  private isBaseImplementation(operation: EffectiveOperation): boolean {
    return operation.implementation.className === this.handler.ctor.name
      && operation.implementation.address === this.handler.address
      && operation.implementation.filePath === this.handler.filePath;
  }

  /** The exact handler entry the pure model selected; no name-only retry or fallback. */
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
