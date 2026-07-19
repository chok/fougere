import { entity, text } from '@fougere/schema';

export default class BuildFrond extends entity({
  name: text({ description: 'Frond name to build (e.g. blog)' }),
}) {}
