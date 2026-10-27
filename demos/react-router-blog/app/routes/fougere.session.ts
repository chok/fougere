import { fougere } from '@fougere/app/web';

export const loader = ({ request }: { request: Request }) => fougere(request);
