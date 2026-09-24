import { entity, text } from '@fougere/schema';

class AuthUser extends entity({ id: text() }) {}

export default AuthUser.extend({ email: text() });
