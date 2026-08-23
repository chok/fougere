import { type Fields } from '@fougere/schema';
import type { Container } from '@fougere/container';
import type { AppMiddleware } from '../wire/middleware.js';
import type { CollectorResolver } from './binding.js';
import { collectorKeyOf } from '../prefab/collector.js';
import { presenterKeyOf } from '../prefab/presenter.js';
import { repositoryKeyOf } from '../prefab/repository.js';
import { resolveContracts, type OperationsMap } from '../wire/operation.js';
import type { InvocationContext } from '../wire/invocation.js';
import type { Emissions } from './Emissions.js';
import type { InFlight } from './inflight.js';
import type { Logger } from '../builtins/logger.js';
import type { EntityEntry, FrondDescriptor, HandlerEntry, PresenterEntry } from '../scan/frond.js';
import { InputValidator } from '../dispatch/InputValidator.js';
import { ArgumentResolver } from '../dispatch/ArgumentResolver.js';
import { OperationExecutor } from '../dispatch/OperationExecutor.js';
import { OutputProjector } from '../dispatch/OutputProjector.js';
import { PresenterExecutor } from '../dispatch/PresenterExecutor.js';
import { PresenterArgumentResolver } from '../dispatch/PresenterArgumentResolver.js';

/** What this door is about: a handler, the entity behind it when there is one, and where it resolves. */
export interface Doorway {
  handler: HandlerEntry;
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
  overrides: FrondDescriptor['operationsOverrides'];
  /** Entity names this frond has a collector for. */
  collectors: Set<string>;
  presenters: Map<string, PresenterEntry>;
  /** The middlewares that apply to an address, read at call time and never at boot. */
  middlewaresFor: (address: string) => AppMiddleware[];
  emissions: Emissions;
  /** The app's running calls — counted here because every caller comes through. */
  inflight: InFlight;
}

/** The field set an op's result is projected onto, and whether it is the whole of it. */
interface View {
  fields: Fields;
  closed: boolean;
}

/** Adapts one handler door to executable operations. */
export class HandlerFacade {
  /** Contracts served by this door. */
  readonly contracts: OperationsMap;

  /** The callable surface: op name → the function a caller reaches. */
  readonly ops: Record<string, Function> = {};

  private readonly cachedViews = new Map<string, View>();
  private instance: any;
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
    this.refuseCrudWithoutRepository();

    door.scope.register(this.handlerKey, handler.ctor, { deps: this.deps() });

    this.contracts = resolveContracts(handler, wiring.overrides, wiring.collectors);
    // Keep scan metadata aligned with the executable contract.
    handler.operations = this.contracts;

    // Emissions use the same contracts and execution path as direct calls.
    wiring.emissions.note(this.contracts, door.key);
    this.judgeFactsByTheirShape();

    // Only declared operations become callable façade members.
    for (const op of this.contracts.keys()) this.ops[op] = this.wrap(op);

    if (this.inheritsCrud && !entity) {
      // An installed Crud subject may be absent from the local scan.
      wiring.log.debug(`${handler.ctor.name} extends Crud() and no scanned entity is named `
        + `'${this.ormBase}' — installed entity, or a missing one: no ORM will be injected`);
    }
  }

  /** Storage follows the Crud subject, which may differ from the door address. */
  private get ormBase(): string {
    return this.door.entity?.name ?? this.door.handler.address;
  }

  private get inheritsCrud(): boolean {
    const proto = this.door.handler.ctor.prototype;
    return typeof proto?.list === 'function' && typeof proto?.findById === 'function';
  }

  private get handlerKey(): string {
    return `_handler:${this.door.key}`;
  }

  private deps(): string[] {
    const { deps } = this.door.handler;
    if (deps.length > 0) return deps;
    return this.inheritsCrud ? [repositoryKeyOf(this.ormBase)] : [];
  }

  /** A custom Crud constructor must explicitly receive its repository. */
  private refuseCrudWithoutRepository(): void {
    const { handler } = this.door;
    const repoTypeName = repositoryKeyOf(this.ormBase);
    if (!this.inheritsCrud || handler.deps.length === 0 || handler.deps.includes(repoTypeName)) return;
    throw new Error(
      `${handler.ctor.name} extends Crud() and declares a constructor, so its storage is no ` +
      `longer injected for it — but it does not take any.\n` +
      `  Add it and hand it to super():\n` +
      `    constructor(repo: ${repoTypeName}, …) { super(repo); }`,
    );
  }

  /** Infer a fact input contract from its announced shape when none is explicit. */
  private judgeFactsByTheirShape(): void {
    for (const [op, contract] of this.contracts) {
      if (contract.input) continue;
      const bound = contract.binding?.find((b) => b.source.kind === 'fact');
      if (!bound || bound.source.kind !== 'fact') continue;
      const shape = this.wiring.emissions.shapeOf(bound.source.factName);
      if (shape) this.contracts.set(op, { ...contract, input: shape });
    }
  }

  /** Resolve and cache the output view declared for one operation. */
  private viewOf(op: string): View {
    const known = this.cachedViews.get(op);
    if (known) return known;

    const { handler, entity } = this.door;
    const perOp = (handler.ctor as { __opOutputs?: Record<string, unknown> })?.__opOutputs?.[op];
    const schema = (perOp
      ?? this.contracts.get(op)?.output
      ?? handler.outputOverride
      ?? (handler.ctor as { __output?: unknown })?.__output
      // Without a declared shape, projection preserves the returned object.
      ?? entity?.entityClass) as { getFields?: () => Fields };
    const resolved: View = {
      fields: typeof schema?.getFields === 'function' ? schema.getFields() : {},
      closed: perOp !== undefined,
    };
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
      inFlight: this.wiring.inflight,
      validator: this.inputValidator,
      arguments: this.argumentResolver,
      invoke: (args) => this.resolvedHandler()[op](...args),
      projector: new OutputProjector(view.fields, view.closed),
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
