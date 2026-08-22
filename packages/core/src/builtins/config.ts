/**
 * The process environment, as a service — so a handler asks for it rather than reading it.
 *
 * `process` is absent on a Worker, where the environment arrives as a binding. Read through
 * `globalThis` and treated as empty when there is none: a missing variable and a missing
 * `process` are the same answer to a caller, and the fallback already says what to do.
 */
export class Config {
  constructor(private readonly env: Record<string, string | undefined> = envOfProcess()) {}

  get<T = string>(key: string, fallback?: T): T {
    return (this.env[key] as T) ?? (fallback as T);
  }
}

function envOfProcess(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env ?? {};
}
