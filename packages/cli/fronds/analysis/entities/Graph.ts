import { entity, text, number } from '@fougere/schema';

export default class Graph extends entity({
  root: text({ description: 'Project root directory (default: cwd)' }),
  minEntities: number({ default: 6, description: 'Minimum entities before suggesting split' }),
}) {}
