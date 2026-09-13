/**
 * Every door an app serves, as TYPES — empty here, and filled from outside by the module the
 * scan writes.
 *
 * The same shape `FougereEntityAdapters` has in `@fougere/schema`: an interface a package
 * declares and never populates, because what fills it is a project's own code. A package cannot
 * import a file that only exists once a project has been built.
 *
 * It lives beside the call contract rather than in `@fougere/app`, because what a door is
 * ADDRESSED by is the same fact on both sides of the wire — and because a backend project runs
 * `fougere build` without ever installing a front-end package.
 *
 * Documented: [observability](https://fougere.dev/docs/infra/observability).
 */
import type { ErrorCode } from './errors.js';

/** What one door answers for, keyed `address.op` — `surface:address.op` for a named surface. */
export interface FougereDoors {}

/**
 * The handler behind each address, carried as `import('…/PostHandler').default`.
 *
 * TypeScript resolves it from the source, so the operations that exist and what each one
 * answers cost the generated module nothing: no signature is printed into it, and none can
 * drift from the class it was read off.
 */
export interface FougereHandlers {}

/** A door whose operations no type describes — an ungenerated project's, and a form's. */
export type AnyHandler = Record<string, (...args: never[]) => Promise<unknown>>;

/**
 * One door: where a call goes, and the handler that answers there.
 *
 * The address is carried as a LITERAL, which is what lets an operation be looked up by
 * `address.op`. A page never builds one by hand — the scan writes a `const` per address, and a
 * page imports it, so a project that never generated them fails to resolve rather than losing
 * its types in silence.
 */
export interface FacadeName<Handler, Address extends string> {
  readonly address: Address;
  /** Never read: it is how the handler's own signatures reach the page. */
  readonly handler?: Handler;
}

type Served = keyof FougereDoors & string;

/**
 * Both halves below take the union through a type PARAMETER, which is what makes the
 * conditional distribute: `Served` is an alias, and an alias is matched whole — `'a.x' | 'b.y'`
 * does not extend `` `${string}.${string}` `` as one thing, so the naive form answers `never`.
 */
type AddressIn<Key> = Key extends `${infer Address}.${string}` ? Address : never;

/**
 * The addresses this app answers at — or any string, until a scan has said otherwise. The
 * `[Served] extends [never]` form is what keeps an ungenerated project compiling: a bare `never`
 * in a parameter position refuses every call, the correct ones included.
 */
export type Addresses = [Served] extends [never] ? string : AddressIn<Served>;

/**
 * The handler that answers at one address. It falls back to an unconstrained door when nothing
 * was generated, because a `never` there would refuse every call a project makes.
 */
export type HandlerOf<Address extends string> =
  [keyof FougereHandlers] extends [never] ? AnyHandler
  : Address extends keyof FougereHandlers ? FougereHandlers[Address] : AnyHandler;

/**
 * What one call can come back refusing — both halves, the frond's and the framework's, as the
 * generated module already merged them. Every code until a scan has narrowed it.
 */
export type Refused<Address extends string, Op extends string> =
  `${Address}.${Op}` extends keyof FougereDoors
    ? FougereDoors[`${Address}.${Op}`] extends { errors: infer Codes }
      ? [Codes] extends [ErrorCode] ? Codes : ErrorCode
      : ErrorCode
    : ErrorCode;

/** What one operation of a handler answers, unwrapped — the page's row type, never restated. */
export type Answer<Handler, Op extends keyof Handler> =
  Handler[Op] extends (...args: never[]) => infer Returned ? Awaited<Returned> : never;

/**
 * The row inside what an operation answers — the page reads rows whether the op returns a list,
 * a page or a single one, so `items` is typed off this rather than off the whole answer.
 */
export type Rows<Answered> = Answered extends readonly (infer Row)[] ? Row
  : Answered extends { items: readonly (infer Row)[] } ? Row
  : Answered;
