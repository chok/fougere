import { lowerFirst, type Fields } from '@fougere/schema';
import type { Container } from '@fougere/container';
import type { AppMiddleware } from '../wire/middleware.js';
import type { CollectorResolver } from '../dispatch/ArgumentResolver.js';
import { collectorKeyOf } from '../prefab/collector.js';
import { presenterKeyOf } from '../prefab/presenter.js';
import { repositoryKeyOf } from '../prefab/repository.js';
import { targetOf } from '../prefab/prefab.js';
import type { OperationContract, OperationsMap } from '../wire/operation.js';
import type { EffectiveOperation, EffectiveOperationsMap } from '../effective-operation.js';
import type { InvocationContext } from '../contract/Invocation.js';
import type { Emissions } from './Emissions.js';
import type { Logger } from '../builtins/logger.js';
import type { EntityEntry, HandlerEntry, PresenterEntry } from '../descriptor/frond.js';
import { InputValidator } from '../dispatch/InputValidator.js';
import { ArgumentResolver } from '../dispatch/ArgumentResolver.js';
import { OperationExecutor } from '../dispatch/OperationExecutor.js';
import { OutputProjector } from '../dispatch/OutputProjector.js';
import { OutputView } from '../dispatch/OutputView.js';
import { PresenterExecutor } from '../dispatch/PresenterExecutor.js';
import { PresenterArgumentResolver } from '../dispatch/PresenterArgumentResolver.js';

/** What this door is about: a handler, the entity behind it when there is one, and where it resolves. */
export interface Doorway {
  handler: HandlerEntry;
  /** Handlers in the owning frond, used to realize a resolved implementation override. */
  handlers: readonly HandlerEntry[];
  /** The canonical operation table resolved before boot performs any side effect. */
  operations: EffectiveOperationsMap;
  /** The subject — absent is ordinary: a health check owns no row. */
  entity: EntityEntry | undefined;
  /** The scope the handler and its collectors resolve in — a surface gets its own. */
  scope: Container;
  /** The container key this door answers under. */
  key: string;
}

/** What the frond and the boot supply to every door alike. */
export interface Wiring {
  /** The frond this door belongs to — travels on every OperationContext. */
  frond: string;
  /** The frond's own scope — where presenters live, whatever sub-scope the door uses. */
  frondScope: Container;
  log: Logger;
  /** Entity names this frond has a collector for. */
  collectors: Set<string>;
  presenters: Map<string, PresenterEntry>;
  /** The middlewares that apply to an address, read at call time and never at boot. */
  middlewaresFor: (address: string) => AppMiddleware[];
  emissions: Emissions;
}

/** Adapts one handler door to executable operations. */
export class HandlerFacade {
  /** Rich operation facts shared with check, explain and adapters. */
  readonly effectiveOperations: EffectiveOperationsMap;
  /** Contracts served by this door. */
  readonly contracts: OperationsMap;

  /** The callable surface: op name → the function a caller reaches. */
  readonly ops: Record<string, Function> = {};

  private readonly cachedViews = new Map<string, OutputView>();
  private instance: any;
  private readonly implementationKeys = new Map<string, string>();
  private readonly implementationInstances = new Map<string, any>();
  private readonly inputValidator = new InputValidator();
  private readonly argumentResolver = new ArgumentResolver(
    (typeName) => this.collectorResolver(typeName),
  );
  private readonly presenterArguments: PresenterArgumentResolver;

  constructor(private readonly door: Doorway, private readonly wiring: Wiring) {
    const { handler, entity } = door;
    this.presenterArguments = new PresenterArgumentResolver(
      this.argumentResolver,
      wiring.collectors,
    );
    this.refuseCrudWithoutRepository(handler);

    door.scope.register(this.handlerKey, handler.ctor, { deps: this.depsOf(handler) });

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
        door.scope.register(key, implementation.ctor, { deps: this.depsOf(implementation) });
        this.implementationKeys.set(operation.implementation.className, key);
      }
    }

    // Emissions use the same contracts and execution path as direct calls.
    wiring.emissions.note(this.contracts, door.key);
    // Only declared operations become callable façade members.
    for (const op of this.contracts.keys()) this.ops[op] = this.wrap(op);

    if (this.inheritsCrud(handler) && !entity) {
      // An installed Crud subject may be absent from the local scan.
      wiring.log.debug(`${handler.ctor.name} extends Crud() and no scanned entity is named `
        + `'${this.subjectOf(handler)}' — installed entity, or a missing one: no storage will be injected`);
    }
  }

  /** Storage follows the Crud subject, which may differ from the door address. */
  private subjectOf(handler: HandlerEntry): string {
    const target = targetOf(handler.ctor);
    return target?.name ? lowerFirst(target.name) : handler.address;
  }

  private inheritsCrud(handler: HandlerEntry): boolean {
    const proto = handler.ctor.prototype;
    return typeof proto?.list === 'function' && typeof proto?.findById === 'function';
  }

  private get handlerKey(): string {
    return `_handler:${this.door.key}`;
  }

  private depsOf(handler: HandlerEntry): string[] {
    const { deps } = handler;
    if (deps.length > 0) return deps;
    return this.inheritsCrud(handler) ? [repositoryKeyOf(this.subjectOf(handler))] : [];
  }

  /** A custom Crud constructor must explicitly receive its repository. */
  private refuseCrudWithoutRepository(handler: HandlerEntry): void {
    const repoTypeName = repositoryKeyOf(this.subjectOf(handler));
    if (!this.inheritsCrud(handler) || handler.deps.length === 0 || handler.deps.includes(repoTypeName)) return;
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
    try { return this.door.scope.resolve(collectorKeyOf(typeName)) as CollectorResolver; }
    catch { return undefined; }
  };

  /** The handler itself, resolved on first call — never at boot. */
  private resolvedHandler(): any {
    if (!this.instance) this.instance = this.door.scope.resolve(this.handlerKey);
    return this.instance;
  }

  private isBaseImplementation(operation: EffectiveOperation): boolean {
    return operation.implementation.className === this.door.handler.ctor.name
      && operation.implementation.address === this.door.handler.address
      && operation.implementation.filePath === this.door.handler.filePath;
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

  private resolvedImplementation(operationName: string): { instance: any; method: string } {
    const operation = this.effectiveOperations.get(operationName)!;
    if (this.isBaseImplementation(operation)) {
      return { instance: this.resolvedHandler(), method: operation.implementation.method };
    }

    const className = operation.implementation.className;
    const key = this.implementationKeys.get(className);
    if (!key) throw new Error(`No registered implementation for EffectiveOperation '${operation.id}'.`);
    let instance = this.implementationInstances.get(key);
    if (!instance) {
      instance = this.door.scope.resolve(key);
      this.implementationInstances.set(key, instance);
    }
    return { instance, method: operation.implementation.method };
  }

  private wrap(op: string): (invocation?: InvocationContext) => Promise<unknown> {
    const address = this.door.handler.address;
    const contract = this.contracts.get(op);
    const view = this.viewOf(op);
    const presenter = this.wiring.presenters.get(address);
    const executor = new OperationExecutor({
      entity: address,
      frond: this.wiring.frond,
      operation: op,
      contract,
      middlewares: () => this.wiring.middlewaresFor(address),
      validator: this.inputValidator,
      arguments: this.argumentResolver,
      invoke: async (args) => {
        const implementation = this.resolvedImplementation(op);
        return implementation.instance[implementation.method](...args);
      },
      projector: new OutputProjector(view),
      ...(view.closed || !presenter ? {} : {
        present: async (result: unknown, effective: InvocationContext) =>
          new PresenterExecutor(
            this.wiring.frondScope.resolve(presenterKeyOf(address)),
            presenter.fields,
            address,
            op,
          ).present(result, await this.presenterArguments.resolve(presenter, effective)),
      }),
    });

    return (invocation) => executor.execute(invocation);
  }
}
