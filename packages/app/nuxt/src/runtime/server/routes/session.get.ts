/**
 * The session view over the wire — same resolution the hydration reads,
 * for a client refreshing after login/logout. Internal route, same
 * family as /_fougere/call.
 */
import { defineEventHandler } from 'h3';
import { sessionViewOf } from '../../session/view.js';

export default defineEventHandler((event) =>
  sessionViewOf((event.context ?? {}) as Record<string, unknown>),
);
