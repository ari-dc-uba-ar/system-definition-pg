import { CoreFieldInfo, SystemEntityContext, TypeCollection } from "system-definition";

/* what this generator needs to read out of a field, on top of the core that system-definition
   guarantees (name, type, nullable):
     - description: the text of the COMMENT ON COLUMN
     - isName     : which field(s) name a row, so a fk to that entity can bring the name along
   Neither belongs to the framework: system-definition's core field info is only what the SSOT
   itself reads, and everything else is declared by each system in its own field def. So the
   generator has to say what it requires, the same way defineTypes is the gate on the other side. */
export type PgFieldInfo<TTypes extends TypeCollection> = CoreFieldInfo<TTypes> & {
    isName: boolean
    description: string
}

/* the bound for "a system this generator can generate from". It is F-bounded (used as
   TContext extends PgContext<TContext>) and that is not decoration: without naming the very
   context being constrained, the type of a field would only be `keyof TypeCollection`, that is
   string, and indexing the PgTypeMap of THAT system with it would not typecheck. Written this
   way, field.type is a key of the system's own types and the map is exhaustive over them.
   A system whose field info lacks description or isName does not compile, and the error says
   exactly which property is missing. */
export type PgContext<TContext extends SystemEntityContext> = SystemEntityContext & {
    completeField: (fieldDef: never, name: string) => PgFieldInfo<TContext['types']>
}
