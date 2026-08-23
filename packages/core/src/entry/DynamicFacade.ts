type Operation = (...args: any[]) => unknown;

/** Facade for a remote contract whose operation names are not known before discovery. */
export class DynamicFacade {
  readonly operations: Record<string, Operation>;

  constructor(private readonly operation: (name: string) => Operation) {
    this.operations = new Proxy({}, {
      get: (_target, name) => this.isOperationName(name) ? this.operation(name) : undefined,
      has: (_target, name) => this.isOperationName(name),
      getOwnPropertyDescriptor: (_target, name) => this.isOperationName(name)
        ? {
            value: this.operation(name),
            writable: false,
            enumerable: true,
            configurable: true,
          }
        : undefined,
    });
  }

  private isOperationName(name: string | symbol): name is string {
    return typeof name === 'string'
      && name !== 'then'
      && name !== 'toJSON'
      && !Object.hasOwn(Object.prototype, name);
  }
}
