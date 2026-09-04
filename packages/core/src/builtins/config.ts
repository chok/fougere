/** The process environment, as a service — so a handler asks for it rather than reading it. */
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
