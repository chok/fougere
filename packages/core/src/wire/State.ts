import { ErrorCode } from './ErrorCode.js';
import { FougereError } from './FougereError.js';
import type { DoorRequest } from './DoorRequest.js';

/**
 * The caller's state as an op reads and writes it — what arrived with the request, and what goes
 * back with the answer — by the names `state:` declares. Asked for by type, as a fact is:
 * `addToCart(id: Product['id'], state: State)`. A value written here is signed before it leaves, so
 * the caller may read it and never change it.
 */
export class State {
  constructor(private readonly request: DoorRequest | undefined) {}

  get<T = unknown>(name: string): T | undefined {
    if (!this.request) return undefined;

    return (this.request.written.has(name) ? this.request.written.get(name) : this.request.arrived.get(name)) as T | undefined;
  }

  set(name: string, value: unknown): void {
    if (!this.request) {
      throw new FougereError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `state.set('${name}') ran outside any request at a door, so there is no caller to keep it — `
          + 'a call made in process, or a runtime with no async context (on a Worker, add "nodejs_compat").',
      });
    }
    if (!this.request.keepable.has(name)) {
      throw new FougereError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `'${name}' cannot be kept at the door '${this.request.door}'. It keeps `
          + `${[...this.request.keepable].join(', ') || 'nothing'}: declare '${name}' in state:, with a way this door carries.`,
      });
    }
    this.request.written.set(name, value);
  }

  delete(name: string): void {
    this.set(name, undefined);
  }
}
