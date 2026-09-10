/** Which account an author belongs to. The blog does not hold this, and should not. */
export default class Tenants {
  of(author: string): string {
    return `acct-${author.replace(/^u-/, '')}`;
  }
}
