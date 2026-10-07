import type { Entity } from '../entity/Entity.js';

export type Resolver = (name: string) => Entity | undefined;
