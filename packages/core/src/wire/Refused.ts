import type { ErrorCode } from './ErrorCode.js';
import type { FougereOperations } from './FougereOperations.js';

/** What one call can come back refusing, the frond's codes and the framework's. */
export type Refused<Address extends string, Op extends string> =
  `${Address}.${Op}` extends keyof FougereOperations
    ? FougereOperations[`${Address}.${Op}`] extends { errors: infer Codes }
      ? [Codes] extends [ErrorCode] ? Codes : ErrorCode
      : ErrorCode
    : ErrorCode;
