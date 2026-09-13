import type { ErrorCode } from './ErrorCode.js';

export interface FougereErrorOptions<Code extends ErrorCode = ErrorCode> {
  code: Code;
  message: string;
  entity?: string;
  operation?: string;
  details?: unknown;
  cause?: unknown;
}
