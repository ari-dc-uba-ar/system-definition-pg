import { TypeCollection, commonTypeDefs } from "system-definition";

/* maps each domain type of a system (a key of its TypeCollection) to the PostgreSQL
   type used for its columns. system-definition only carries the TypeScript side (tsType);
   the SQL side is decided by whoever generates the database, hence a separate map. */
export type PgTypeMap<TypeDefs extends TypeCollection> = Record<keyof TypeDefs, string>

/* the common types of system-definition get their columns here, so that no system has to
   write again that a text is a `text`. A system spreads this and adds its own types:
   `{...commonPgTypeMap, fecha: 'date'}`. */
export var commonPgTypeMap: PgTypeMap<typeof commonTypeDefs> = {
    text   : 'text',
    integer: 'integer',
    boolean: 'boolean',
}
