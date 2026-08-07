import { entity, text } from '@fougere/schema';

export default class Check extends entity({
  root: text({ description: 'Project root directory (default: cwd)' }),
}) {}
