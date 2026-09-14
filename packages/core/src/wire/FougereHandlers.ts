/**
 * The handler behind each address, carried as `import('…/PostHandler').default`.
 *
 * TypeScript resolves it from the source, so the operations that exist and what each one
 * answers cost the generated module nothing: no signature is printed into it, and none can
 * drift from the class it was read off.
 */
export interface FougereHandlers {}
