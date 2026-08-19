import { vocabulary } from "./vocabulary.js";
import { Field } from "../Field.js";
import { Unique } from "../constraint/Unique.js";

export const unique: <T>(field: Field<T>) => Field<T> = vocabulary(
  "unique",
  (field) => ({
    role: { rules: [...(field.role?.rules ?? []), Unique.self()] },
  }),
);
