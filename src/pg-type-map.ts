import { SystemTypeContext } from "system-definition";

/* maps each domain type of a system (a key of its type collection) to the PostgreSQL
   type used for its columns. system-definition only carries the TypeScript side (tsType);
   the SQL side is decided by whoever generates the database, hence a separate map.
   It is exhaustive: a system that adds a type does not compile until it says how to store it. */
export type PgTypeMap<TContext extends SystemTypeContext> = Record<keyof TContext['types'], string>
