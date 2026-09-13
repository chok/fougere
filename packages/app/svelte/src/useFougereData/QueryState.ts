import type { FougereError } from '@fougere/core/contract';
import { type Rows } from '@fougere/app/client';

export interface QueryState<Answered> {
  data: Answered | null;
  items: Rows<Answered>[];
  total?: number;
  hasMore?: boolean;
  loading: boolean;
  error: FougereError | null;
}
