import { AUTH, type App, type AuthRuntime } from '@fougere/core';

export function authOf(app: App): AuthRuntime | undefined {
  return app.container.has(AUTH) ? app.container.resolve<AuthRuntime>(AUTH) : undefined;
}
