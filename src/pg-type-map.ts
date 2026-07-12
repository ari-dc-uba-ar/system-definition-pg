import { TypeCollection } from "system-definition";

/* maps each domain type of a system (a key of its TypeCollection) to the PostgreSQL
   type used for its columns. system-definition only carries the TypeScript side (tsType);
   the SQL side is decided by whoever generates the database, hence a separate map. */
export type PgTypeMap<TypeDefs extends TypeCollection> = Record<keyof TypeDefs, string>
