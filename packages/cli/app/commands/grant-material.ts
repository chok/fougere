/** Where the root lives. `.fougere/` already holds generated local state. */
export const ROOT_KEY = '.fougere/root.key';

/** A PEM spans lines and an env var carrying one survives compose, systemd and CI poorly. */
export const packed = (pem: string) => Buffer.from(pem, 'utf8').toString('base64');
