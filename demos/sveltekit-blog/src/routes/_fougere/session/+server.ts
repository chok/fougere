import { fougere } from '@fougere/app/web';

export const GET = ({ request }: { request: Request }) => fougere(request);
