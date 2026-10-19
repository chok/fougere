/** One answer a door middleware may give in an op's place — a status, and the headers it sets. */
export interface DeclaredAnswer {
  status: number;
  headers: string[];
}
