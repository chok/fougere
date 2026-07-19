export class Config {
  get<T = string>(key: string, fallback?: T): T {
    return (process.env[key] as T) ?? (fallback as T);
  }
}
