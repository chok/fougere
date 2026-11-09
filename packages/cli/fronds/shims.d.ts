declare module 'safe-regex' {
  export default function safeRegex(
    pattern: string | RegExp,
    options?: { limit?: number },
  ): boolean;
}
