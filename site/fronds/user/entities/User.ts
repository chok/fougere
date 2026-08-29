import { AuthUser } from '@fougere/auth-better';

/**
 * Site account — better-auth fields as-is. The named subclass exists so the
 * scanner registers the entity as `User` and pages/handlers have a class to
 * designate. `.anchor()` says these rows are its own: it keeps every field of
 * `AuthUser`, so nothing else could tell an entity from a shape of one.
 */
export default class User extends AuthUser.extend({}).anchor() {}
