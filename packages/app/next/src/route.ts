import { fougere } from '@fougere/app/web';

const handle = (request: Request) => fougere(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
