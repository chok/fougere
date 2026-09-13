import { ScopeContainer } from './ScopeContainer.js';
import type { Container } from './Container.js';

export type { Container };

export function createContainer(): Container {
  return new ScopeContainer();
}
