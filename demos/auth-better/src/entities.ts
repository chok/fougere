/**
 * App entities — same single-schema convention as the rest of Fougere.
 *
 * `User` is the user-owned entity (not the package's default), extended with
 * an app-specific `role` field. Better-auth sees it as the user model and
 * accepts the extra column via `additionalFields` (handled by the adapter).
 */
import { entity, primary, text, bool, date, auto, ref, optional, oneOf } from '@fougere/schema';
import { AuthUser } from '@fougere/auth-better';

/**
 * User entity — extends the package default with a `role`.
 * Optional because better-auth's sign-up flow doesn't know about app-specific
 * fields; downstream code can populate it (e.g. via a databaseHook or admin UI).
 */
export class User extends AuthUser.extend({
  role: optional(oneOf('admin', 'user')),
}) {}

/** A simple note — domain entity unrelated to auth. */
export class Note extends entity({
  id: primary(),
  userId: text(),
  title: text({ min: 1, max: 200 }),
  content: optional(text()),
  createdAt: auto(),
}) {}

/** Input schema for note creation — derived from Note. */
export class CreateNote extends Note.pick('title', 'content') {}
