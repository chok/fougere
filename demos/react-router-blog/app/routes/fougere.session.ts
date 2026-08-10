import { fougereSession } from '@fougere/app/web';

export const loader = ({ request }: { request: Request }) => fougereSession(request);
