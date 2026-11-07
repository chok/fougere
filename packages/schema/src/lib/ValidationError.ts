export interface ValidationError {
  /** Where the refusal happened, as segments; empty when the whole input is refused. */
  path: readonly string[];
  message: string;
}
