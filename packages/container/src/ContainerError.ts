export class ContainerError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'ContainerError';
  }
}
