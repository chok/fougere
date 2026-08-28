import { entity, bool, number, text } from '@fougere/schema';

/** `fougere devtools` — what a running app is dispatching, as it happens. */
export default class Devtools extends entity({
  url: text({ default: 'http://127.0.0.1:3000', description: 'The running app to read. Its host serves /_fougere/call' }),
  since: number({ default: 0, description: 'Only calls above this cursor' }),
  json: bool({ default: false, description: 'Print one page as JSON and stop, instead of following' }),
}) {}
