import { typeDefs } from "system-definition/examples";

import { PgTypeMap } from "../../src/pg-type-map";

/* the pg type map is decided by whoever generates the database, not by system-definition:
   here 'fecha' (año/mes/día) is stored as a plain SQL date; converting between the two
   shapes is a serialization concern outside the scope of this schema generator. */
export var aidaPgTypeMap: PgTypeMap<typeof typeDefs> = {
    text   : 'text',
    integer: 'integer',
    boolean: 'boolean',
    fecha  : 'date',
    email  : 'text',
}
