// `safe-regex` ships no types, and `@types/safe-regex` describes its version 1 while the
// package here is version 2. The exported signature did not move between the two, so the
// shim states it rather than pinning a types package a major behind.
declare module 'safe-regex' {
  export default function safeRegex(
    pattern: string | RegExp,
    options?: { limit?: number },
  ): boolean;
}
