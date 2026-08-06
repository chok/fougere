import { entity, primary, number } from '@fougere/schema';

export default class Commande extends entity({
  id: primary(),
  wanted: number({ min: 1 }),
}) {}
