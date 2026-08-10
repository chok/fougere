/**
 * The REST projection. A static route of your own — `app/api/health/route.ts` —
 * is resolved by Next before this catch-all, so adding this file takes nothing away.
 */
export { GET, POST, PUT, PATCH, DELETE } from '@fougere/next/rest';
