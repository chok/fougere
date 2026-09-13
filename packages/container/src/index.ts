import { ScopeContainer } from './ScopeContainer.js';
import type { Container } from './Container.js';
import type { Constructor } from './registration/Constructor.js';

export type { Container, Constructor };

export function createContainer(): Container {
  return new ScopeContainer();
}
