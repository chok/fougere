import { entity, bool, text } from '@fougere/schema';

export default class Load extends entity({
  root: text({ description: 'Project root directory (default: cwd)' }),
  door: text({ description: 'Where the calls go (default: http://127.0.0.1:3000/_fougere/call)' }),
  out: text({ description: 'Where to write it, or empty to print it on stdout (default: <root>/load.js)' }),
  json: bool({ default: false, description: 'Print the scenario as JSON, with nothing else on stdout' }),
}) {}
