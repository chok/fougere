import { entity, bool, text } from '@fougere/schema';

export default class Check extends entity({
  root: text({ description: 'Project root directory (default: cwd)' }),
  json: bool({ default: false, description: 'Print the report as JSON, with nothing else on stdout' }),
}) {}
