/** An op another process serves that is handed a fact when it is announced. */
export interface RemoteListener {
  address: string;
  op: string;
}
