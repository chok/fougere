import { entity, primary, text } from '@fougere/schema';

export default class Commande extends entity({
  id: primary(),
  reference: text({ min: 1 }),
}) {}
