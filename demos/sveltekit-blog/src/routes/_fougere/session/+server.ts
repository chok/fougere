import { fougereSession } from '@fougere/app/web';

export const GET = ({ request }: { request: Request }) => fougereSession(request);
