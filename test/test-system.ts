import { CoreFieldDef, commonTypeBehaviours, commonTypeDefs, completeCoreField, defineTypes } from "system-definition";

/* the fixture the tests describe their little systems with. It exists because the generator
   does not accept just any context: it needs a field info carrying description and isName
   (see src/pg-context.ts), and those belong to the system, not to the framework. So the tests
   have to be a system that declares them, the same way examples/aida is. */
export type TestFieldDef = CoreFieldDef<typeof commonTypeDefs> & {
    isName?: boolean
    description?: string
}

export const testTypes = defineTypes({
    types: commonTypeDefs,
    behaviours: commonTypeBehaviours,
    completeField: (fieldDef: TestFieldDef, name: string) => ({
        ...completeCoreField(fieldDef, name),
        isName     : fieldDef.isName ?? false,
        description: fieldDef.description ?? '',
    }),
})

export const testPgTypeMap = {
    text   : 'text',
    integer: 'integer',
    boolean: 'boolean',
}
