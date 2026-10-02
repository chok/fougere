import { ScopeContainer } from './ScopeContainer.js';
import { ContainerError } from './ContainerError.js';
import type { Container } from './Container.js';
import type { Constructor } from './registration/Constructor.js';
import type { Lifetime } from './registration/Lifetime.js';
import type { RegisterOptions } from './registration/RegisterOptions.js';
import type { Unresolved } from './Unresolved.js';

export type { Container, Constructor, RegisterOptions, Lifetime, Unresolved };
export { ContainerError };

export function createContainer(): Container {
  return new ScopeContainer();
}
