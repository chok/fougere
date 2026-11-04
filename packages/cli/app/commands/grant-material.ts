/** Where the root lives — never `.fougere/`, whose content can be deleted: a new root recognizes no grant issued so far. */
export const ROOT_KEY = 'fougere.key';

/** A PEM spans lines and an env var carrying one survives compose, systemd and CI poorly. */
export const packed = (pem: string) => Buffer.from(pem, 'utf8').toString('base64');
