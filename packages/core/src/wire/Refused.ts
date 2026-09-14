import type { ErrorCode } from './ErrorCode.js';
import type { FougereOperations } from './FougereOperations.js';

/**
 * What one call can come back refusing — both halves, the frond's and the framework's, as the
 * generated module already merged them. Every code until a scan has narrowed it.
 */
export type Refused<Address extends string, Op extends string> =
  `${Address}.${Op}` extends keyof FougereOperations
    ? FougereOperations[`${Address}.${Op}`] extends { errors: infer Codes }
      ? [Codes] extends [ErrorCode] ? Codes : ErrorCode
      : ErrorCode
    : ErrorCode;
