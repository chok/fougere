import { entity, bool, optional, text } from '@fougere/schema';

/** `fougere points` — what answers each extension point of the app. */
export default class Points extends entity({
  root: optional(text({ description: 'Project to read. Default: the current directory' })),
  json: bool({ default: false, description: 'Print the report as JSON, with nothing else on stdout' }),
}) {}
