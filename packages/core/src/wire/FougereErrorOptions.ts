import type { ErrorCode } from './ErrorCode.js';

export interface FougereErrorOptions<Code extends ErrorCode = ErrorCode> {
  code: Code;
  message: string;
  address?: string;
  operation?: string;
  details?: unknown;
  cause?: unknown;
}
