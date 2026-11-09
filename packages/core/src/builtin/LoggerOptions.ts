import type { LineBuffer } from './LineBuffer.js';

export interface LoggerOptions {
  /** Logger name / prefix. */
  name?: string;
  /** Where its lines go; without one, the console only. */
  lineBuffer?: LineBuffer;
  /** The operation a line is written inside, asked at each line — the boot hands it over. */
  during?: () => string | undefined;
  /** Force color on/off. Auto-detected by default. */
  color?: boolean;
}
