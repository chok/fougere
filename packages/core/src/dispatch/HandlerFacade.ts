import type { Fields } from '@fougere/schema';
import type { Container } from '@fougere/container';
import {
  runMiddlewares,
  type AppMiddleware,
  type OperationContext,
} from '../wire/middleware.js';
import type { CollectorResolver } from './ArgumentResolver.js';
import { collectorKeyOf } from '../prefab/collector.js';
import { inheritsCrud, subjectOf } from '../prefab/crud.js';
import { presenterKeyOf } from '../prefab/presenter.js';
import { repositoryKeyOf } from '../prefab/repository.js';
import type { OperationContract, OperationsMap } from '../wire/operation.js';
import type { EffectiveOperation, EffectiveOperationsMap } from '../effective-operation.js';
import type { BindingPlan } from '../wire/binding.js';
import { canonicalInvocation, type InvocationContext } from '../wire/Invocation.js';
import type { HandlerEntry, PresenterEntry } from '../descriptor/frond.js';
import { ArgumentResolver } from './ArgumentResolver.js';
import { OutputView } from './OutputView.js';
import { PresenterExecutor } from './PresenterExecutor.js';
import { presenterArguments, presenterPlans } from './presenterArguments.js';
import { validateInput } from './validateInput.js';

/** What boot resolved around one handler, beyond the handler and the scope it resolves in. */
export interface Door {
  /** The container key this door answers under. */
  key: string;
  /** The frond this door belongs to — travels on every OperationContext. */
  frond: string;
  /** Handlers in the owning frond, used to realize a resolved implementation override. */
  handlers: readonly HandlerEntry[];
  /** The canonical operation table resolved before boot performs any side effect. */
  operations: EffectiveOperationsMap;
  /** Entity names this frond has a collector for. */
  collectors: Set<string>;
  /** The presenter over this handler's entity, when the frond declares one. */
  presenter: PresenterEntry | undefined;
  /** Presenters live in the frond's own scope, whatever sub-scope this door resolves in. */
  presenterScope: Container;
  /** The middlewares that apply to this address, read at call time and never at boot. */
  middlewares: () => AppMiddleware[];
}

/** Adapts one handler door to executable operations. */
export class HandlerFacade {
  /** Rich operation facts shared with check, explain and adapters. */
  readonly effectiveOperations: EffectiveOperationsMap;
  /** Contracts served by this door. */
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

  constructor(
    private readonly handler: HandlerEntry,
    private readonly scope: Container,
    private readonly door: Door,
  ) {
    this.refuseCrudWithoutRepository(handler);

    this.presenterPlans = door.presenter
      ? presenterPlans(door.presenter, door.collectors)
      : new Map();

    scope.register(this.handlerKey, handler.ctor, { deps: this.depsOf(handler) });

    this.effectiveOperations = door.operations;
    this.contracts = new Map(
      [...door.operations].map(([name, operation]) => [name, operation as OperationContract] as const),
    );
    handler.operations = this.contracts;

    // Register model-selected implementations in the same execution scope.
    for (const [name, operation] of door.operations) {
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

    const invocation = canonicalInvocation(input);
    const context: OperationContext = {
      entity,
      frond: this.door.frond,
      operation: op,
      args: [],
      state: invocation.state,
      invocation,
    };

    return runMiddlewares(this.door.middlewares(), context, async () => {
      const validated = validateInput(contract.input, invocation, entity, op);
      context.invocation = validated;

      const args = contract.binding
        ? await this.arguments.resolve(contract.binding, validated)
        : [];
      const { instance, method } = this.resolveImplementation(op);
      const view = this.viewOf(op);
      const output = view.project(await instance[method](...args));

      const { presenter } = this.door;
      return view.closed || !presenter ? output : this.present(op, presenter, output, validated);
    });
  }

  /** The computed fields a presenter adds, over the page the façade just projected. */
  private present(
    op: string,
    presenter: PresenterEntry,
    output: unknown,
    invocation: InvocationContext,
  ): Promise<unknown> {
    const entity = this.handler.address;
    const executor = new PresenterExecutor(
      this.door.presenterScope.resolve(presenterKeyOf(entity)),
      presenter.fields,
      entity,
      op,
    );

    return presenterArguments(this.presenterPlans, invocation, this.arguments)
      .then((args) => executor.present(output, args));
  }

  private get handlerKey(): string {
    return `_handler:${this.door.key}`;
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

  private collectorResolver = (typeName: string): CollectorResolver | undefined => {
    try { return this.scope.resolve(collectorKeyOf(typeName)) as CollectorResolver; }
    catch { return undefined; }
  };

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
    const matches = this.door.handlers.filter((handler) =>
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
