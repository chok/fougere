import { entity, primary, text, oneOf } from '@fougere/schema';

export default class User extends entity({
  id: primary(),
  email: text({ min: 1 }),
  // `oneOf` est un helper de champ, pas une option de `text` — un jeu de valeurs
  // borné EST un type, il ne se déclare pas comme une contrainte sur une chaîne.
  role: oneOf('reader', 'admin'),
}) {}
