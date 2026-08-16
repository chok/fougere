import { Judge, type Fields, type SchemaView } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { ErrorCode, FougereError } from './errors.js';
import { runMiddlewares, type AppMiddleware } from './middleware.js';
import { computeBindingPlan, resolveArgs, type CollectorResolver } from './binding.js';
import { collectorKeyOf } from './collector.js';
import { presenterKeyOf } from './presenter.js';
import { ormKeyOf } from './orm.js';
import { resolveContracts, type OperationsMap } from './operation.js';
import { projectEgress, presentEgress, type PresenterArgs } from './egress.js';
import { EMPTY_INVOCATION, type InvocationContext } from './invocation.js';
import type { Emissions } from './Emissions.js';
import type { Logger } from './builtins/logger.js';
import type { EntityEntry, FrondDescriptor, HandlerEntry, PresenterEntry } from './frond.js';

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
}

/** The field set an op's result is projected onto, and whether it is the whole of it. */
interface View {
  fields: Fields;
  closed: boolean;
}

/**
 * The door a handler answers on: its contracts, the view each op emits, and the one call
 * path every caller takes — judge, bind, project, present.
 *
 * A façade is built FROM a handler — that is the whole rule, and the entity is OPTIONAL.
 * An entity is a shape, not a surface: on its own it declares no operation, so it gets no
 * façade and answers nothing. The converse used to be false in fact though true on paper —
 * the boot walked entities, so a handler naming no entity was scanned and then silently
 * never built. An operation about no stored row (`health.check`, a pure computation) is an
 * ordinary case, not a gap to accommodate.
 *
 * Without an entity a façade loses exactly three things, and nothing else: the ORM injected
 * by convention, the output fields to project onto, and the presenter. Its result travels
 * as the handler returned it.
 *
 * It registers nothing. The boot puts `ops` and `contracts` in the container under the
 * audience they belong to; this class knows a scope to RESOLVE from and no more.
 */
export class HandlerFacade {
  /**
   * The contracts this door serves — resolved once, from the three producers, so nobody
   * re-derives them and drifts.
   */
  readonly contracts: OperationsMap;

  /** The callable surface: op name → the function a caller reaches. */
  readonly ops: Record<string, Function> = {};

  private readonly cachedViews = new Map<string, View>();
  private instance: any;

  constructor(private readonly door: Doorway, private readonly wiring: Wiring) {
    const { handler, entity } = door;
    this.refuseCrudWithoutOrm();

    door.scope.register(this.handlerKey, handler.ctor, { deps: this.deps() });

    this.contracts = resolveContracts(handler, wiring.overrides, wiring.collectors);
    // Handed BACK, because "resolved once" was not true elsewhere: the adapters read
    // `handler.operations` — the scan's raw map — so an op a prefab declared and the
    // scan never saw reached the façade and no projection. Four of the five CRUD ops
    // were absent from GraphQL on any installed app.
    handler.operations = this.contracts;

    /**
     * Who listens to what — noted HERE because this is where a contract becomes real,
     * and read from the PLAN rather than from the AST: `{ kind: 'fact' }` is a sentence
     * `computeBindingPlan` already wrote.
     *
     * A subscriber is an ordinary op. It keeps its door, its judge and its middlewares —
     * an emission and a direct call are the same call, which is why nothing here has to
     * build a second path.
     */
    wiring.emissions.note(this.contracts, door.key);
    this.judgeFactsByTheirShape();

    // The surface IS the contract table. A method nobody declared is not an op: it stays
    // a method, callable from inside, unreachable from the wire.
    for (const op of this.contracts.keys()) this.ops[op] = this.wrap(op);

    if (this.inheritsCrud && !entity) {
      // A Crud handler whose subject is not among the scanned entities is either broken
      // or installed — `Crud(Note)` from a published package is legitimate and the scan
      // cannot see it (heritage resolution is workspace-only). Refusing at boot would
      // break the second case to catch the first, so it is said, not thrown.
      wiring.log.debug(`${handler.ctor.name} extends Crud() and no scanned entity is named `
        + `'${this.ormBase}' — installed entity, or a missing one: no ORM will be injected`);
    }
  }

  /**
   * The ORM belongs to the SUBJECT, never to the address. `StockHandler extends Crud(Item)`
   * is called `stock` and reads `Item`; asking for `StockOrm` would be asking the address
   * for a table. The two coincide in the ordinary case and that is why it went unnoticed.
   */
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
    return this.inheritsCrud ? [ormKeyOf(this.ormBase)] : [];
  }

  /**
   * Declaring a constructor turns the automatic ORM injection OFF — the handler now states
   * what it takes, and that is the whole DI convention. But a Crud handler that forgets to
   * state its ORM used to get `this.orm === undefined` and break on the FIRST REQUEST,
   * silently: `super()` assigns whatever it was handed. Refused at boot instead, naming the
   * fix — the clause is deducible, so it is stated, not configured.
   */
  private refuseCrudWithoutOrm(): void {
    const { handler } = this.door;
    const ormTypeName = ormKeyOf(this.ormBase);
    if (!this.inheritsCrud || handler.deps.length === 0 || handler.deps.includes(ormTypeName)) return;
    throw new Error(
      `${handler.ctor.name} extends Crud() and declares a constructor, so the ORM is no ` +
      `longer injected for it — but it does not take one.\n` +
      `  Add it and hand it to super():\n` +
      `    constructor(orm: ${ormTypeName}, …) { super(orm); }`,
    );
  }

  /**
   * A fact is judged on arrival, by the entity it IS.
   *
   * The scan never fills `input` from a parameter type, so a subscriber's payload met no
   * judge at all — tolerable while it came from an emitter in this very process, false the
   * moment it comes off a wire, from another repository, from an older emitter, or out of a
   * queue that held it for three days. A fact is an entity: it has a card, `reconstruct`
   * rebuilds it on the far side, so the same judge stands on both ends.
   *
   * A contract that states its own `input` wins: the three producers keep their order.
   */
  private judgeFactsByTheirShape(): void {
    for (const [op, contract] of this.contracts) {
      if (contract.input) continue;
      const bound = contract.binding?.find((b) => b.source.kind === 'fact');
      if (!bound || bound.source.kind !== 'fact') continue;
      const shape = this.wiring.emissions.shapeOf(bound.source.factName);
      if (shape) this.contracts.set(op, { ...contract, input: shape });
    }
  }

  /**
   * The field set an op's result is projected onto — the view declared for THAT op
   * (`Crud(Post, { list: PostCard })`), else the handler-wide view (`Crud(Post,
   * PostPublic)`), else the entity. Each op is the audience of its own view: a public
   * index emits cards while `bySlug` emits the full row, from one handler reading one
   * full-row ORM. Resolved once per op, on first call.
   */
  private viewOf(op: string): View {
    const known = this.cachedViews.get(op);
    if (known) return known;

    const { handler, entity } = this.door;
    const perOp = (handler.ctor as { __opOutputs?: Record<string, unknown> })?.__opOutputs?.[op];
    const schema = (perOp
      ?? this.contracts.get(op)?.output
      ?? handler.outputOverride
      ?? (handler.ctor as { __output?: unknown })?.__output
      // No entity and nothing declared: there is no shape to project onto, so the result
      // travels as the handler returned it (`encodeFields({}, r)` is `{…r}`).
      ?? entity?.entityClass) as { getFields?: () => Fields };
    // A view named for THIS op is a closed list: the author said what this audience gets.
    // The handler-wide forms already narrow at the ORM.
    const resolved: View = {
      fields: typeof schema?.getFields === 'function' ? schema.getFields() : {},
      closed: perOp !== undefined,
    };
    this.cachedViews.set(op, resolved);
    return resolved;
  }

  private collectorResolver = (entityName: string): CollectorResolver | undefined => {
    try { return this.door.scope.resolve(collectorKeyOf(entityName)) as CollectorResolver; }
    catch { return undefined; }
  };

  /** The handler itself, resolved on first call — never at boot. */
  private resolvedHandler(): any {
    if (!this.instance) this.instance = this.door.scope.resolve(this.handlerKey);
    return this.instance;
  }

  /**
   * One op, as a caller meets it: middlewares, then judge, bind, project, present.
   *
   * The name the door answers to reaches the presenter map, which is keyed by ENTITY
   * name — they coincide whenever both exist, and when no entity carries this name the
   * lookup simply misses, which is the correct answer.
   */
  private wrap(op: string): (invocation?: InvocationContext) => Promise<unknown> {
    const address = this.door.handler.address;

    return (invocation?: InvocationContext) => {
      const inv = invocation ?? EMPTY_INVOCATION;
      const ctx = { entity: address, operation: op, args: [], state: inv.state, invocation: inv };

      return runMiddlewares(this.wiring.middlewaresFor(address), ctx, async () => {
        const contract = this.contracts.get(op);
        const effective = this.judged(contract?.input, inv, address, op);
        ctx.invocation = effective;

        // No plan means no declared argument — an op receives what its contract says it
        // receives, never a guess based on its name.
        const args = contract?.binding
          ? await resolveArgs(contract.binding, effective, this.collectorResolver)
          : [];

        // Egress at the boundary: a write-only field never rides the result out, exactly
        // as REST and Pothos already guarantee on their own — then a presenter's computed
        // fields are added, so every door answers the same thing (they used to be applied
        // by the projections alone).
        const view = this.viewOf(op);
        const projected = projectEgress(view.fields, await this.resolvedHandler()[op](...args), view.closed);
        if (view.closed) return projected;

        const meta = this.wiring.presenters.get(address);
        if (!meta) return projected;
        return presentEgress(
          projected,
          this.wiring.frondScope.resolve(presenterKeyOf(address)),
          meta.fields,
          address,
          op,
          await this.presenterArgs(meta, effective),
        );
      });
    };
  }

  /**
   * The client's input, or a refusal. The view's mode travels with it: a `partial()` input
   * validates as a patch (absent field → untouched), never by forging the fields.
   *
   * No field filter: the axes already judge every case — a client id at create is accepted
   * (`{ generate }`), an id re-supplied in a patch is 'Immutable', a read-only field
   * 'Read-only', every system-stamped absence is legal via its lifecycle rule, and a key
   * outside the contract is 'Unknown field' (refused, not stripped).
   */
  private judged(
    schema: SchemaView | undefined,
    inv: InvocationContext,
    address: string,
    op: string,
  ): InvocationContext {
    if (!schema || !inv.body || typeof inv.body !== 'object') return inv;

    const result = Judge.row(schema.getFields(), inv.body, { patch: schema.getOpts().patch });
    if (!result.success) {
      throw new FougereError({
        code: ErrorCode.VALIDATION_FAILED,
        message: result.errors.map((e) => `${e.path}: ${e.message}`).join(', '),
        details: result.errors,
        entity: address,
        operation: op,
      });
    }
    return { ...inv, body: result.data };
  }

  /**
   * A computed field is bound like an op: what it declares after the rows is resolved from
   * the same invocation, by the same collectors. The plan is computed here and not at scan
   * time because the scan meets presenters before it meets collectors.
   */
  private async presenterArgs(meta: PresenterEntry, inv: InvocationContext): Promise<PresenterArgs> {
    const args: PresenterArgs = {};
    for (const field of meta.fieldMeta) {
      if (!field.params?.length) continue;
      args[field.name] = await resolveArgs(
        computeBindingPlan(field.params, this.wiring.collectors),
        inv,
        this.collectorResolver,
      );
    }
    return args;
  }
}
