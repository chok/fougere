export interface UsersFacet {
  name: string;
  email?: string;
  role?: string;
  state?: {
    field: string;
    active?: readonly string[];
    invited?: readonly string[];
    suspended?: readonly string[];
  };
  createdAt?: string;
}
