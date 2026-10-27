export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
