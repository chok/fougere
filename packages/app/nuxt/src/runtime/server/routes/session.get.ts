/** The session view over the wire — same resolution the hydration reads, for a client refreshing aft… */
import { defineEventHandler } from 'h3';
import { sessionViewOf } from '@fougere/app';

export default defineEventHandler((event) =>
  sessionViewOf((event.context ?? {}) as Record<string, unknown>),
);
