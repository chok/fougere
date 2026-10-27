/** A port whose type argument names what it stands in front of. */
export default class Gate<H = never> {
  declare private readonly subject?: H;
  pass(): string { return 'passed'; }
}
