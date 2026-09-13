/** A frond this process knows about, and whether it runs here. */
export interface FrondPlacement {
  frond: string;
  placement: 'local' | 'remote';
  entities: number;
  facades: number;
}
