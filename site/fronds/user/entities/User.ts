import { AuthUser } from '@fougere/auth-better';

/**
 * Site account — better-auth fields as-is. The named subclass exists so the
 * scanner registers the entity as `User` and pages/handlers have a class to
 * designate.
 */
export default class User extends AuthUser.extend({}) {}
