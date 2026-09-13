/** One frond calling another — an edge of the graph, counted where the call was made. */
export interface Edge {
  from: string;
  to: string;
  count: number;
  errors: number;
}
