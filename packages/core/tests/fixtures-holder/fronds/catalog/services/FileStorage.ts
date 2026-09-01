/** An ordinary provider whose NAME ends in the key's suffix, holding no entity's rows. */
export default class FileStorage {
  path(name: string): string {
    return `/files/${name}`;
  }
}
