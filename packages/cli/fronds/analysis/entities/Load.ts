import { entity, bool, text } from '@fougere/schema';

export default class Load extends entity({
  root: text({ description: 'Project root directory (default: cwd)' }),
  facade: text({ description: 'Where the calls go (default: http://127.0.0.1:3000/_fougere/call)' }),
  out: text({ description: 'Where to write it, or empty to print it on stdout (default: <root>/load.js)' }),
  force: bool({ default: false, description: 'Replace an existing file, and the weights, stages and thresholds edited in it' }),
  json: bool({ default: false, description: 'Print the scenario as JSON, with nothing else on stdout' }),
}) {}
