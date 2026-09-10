import { session } from '@fougere/app/web';

export const loader = ({ request }: { request: Request }) => session(request);
