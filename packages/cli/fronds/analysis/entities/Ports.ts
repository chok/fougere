import { entity, bool, optional, text } from '@fougere/schema';

/** `fougere ports` — what answers each port of the app, and each registry. */
export default class Ports extends entity({
  root: optional(text({ description: 'Project to read. Default: the current directory' })),
  json: bool({ default: false, description: 'Print the report as JSON, with nothing else on stdout' }),
}) {}
