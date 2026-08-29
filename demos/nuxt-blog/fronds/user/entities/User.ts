import { oneOf, optional } from '@fougere/schema';
import { AuthUser } from '@fougere/auth-better';

/**
 * Blog user — extends AuthUser with a role used by the editor/admin pages.
 *
 * We wrap the extend() result in a named class so the scanner picks `User`
 * as the entity name (instead of the anonymous `Schema` class that extend()
 * produces by default). `.anchor()` says these rows are its own rather than
 * a shape of `AuthUser`'s.
 */
export default class User extends AuthUser.extend({
  role: optional(oneOf('admin', 'editor', 'reader')),
}).anchor() {}
