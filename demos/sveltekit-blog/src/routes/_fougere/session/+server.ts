import { session } from '@fougere/app/web';

export const GET = ({ request }: { request: Request }) => session(request);
