export class ContainerError extends Error {
  constructor(message: string) {
    super(message);

    this.name = new.target.name;
  }

  static all(failures: unknown[], message: string): AggregateError {
    return new AggregateError(failures, message);
  }
}
