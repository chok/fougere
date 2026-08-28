import { entity, bool, text, optional } from '@fougere/schema';

/** `fougere devtools` — what the running apps of this project are dispatching. */
export default class Devtools extends entity({
  url: optional(text({ description: 'One app to read. Absent: every address this project declares' })),
  root: optional(text({ description: 'Project to read the addresses from. Default: the current directory' })),
  json: bool({ default: false, description: 'Print one page as JSON and stop, instead of following' }),
}) {}
