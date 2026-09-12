import { EntityDef, EntityInfo, SystemEntityContext, completeEntity } from "system-definition";

/* a whole system's entities, already completed (Def -> Info): what generators that need to
   look across entities (e.g. resolving what a foreign key points at) consume. The key is the
   entity's own name, which the Def now carries, so nothing here has to be told it twice. */
export type EntityInfoMap<TContext extends SystemEntityContext> = Record<string, EntityInfo<TContext>>

/* the cast is not hiding anything: for a CONCRETE system the precise Info that completeEntity
   returns (EntityInfoOf) is assignable to the wide one, and there is a test that asserts it.
   What the compiler cannot prove is the same thing for a context that is still a type parameter,
   because EntityInfoOf reaches the field info through a deferred Omit. */
export function completeEntities<TContext extends SystemEntityContext>(
    context: TContext, entityDefs: Record<string, EntityDef<TContext>>
): EntityInfoMap<TContext> {
    return Object.fromEntries(
        Object.values(entityDefs).map(entityDef => [entityDef.name, completeEntity(context, entityDef)])
    ) as unknown as EntityInfoMap<TContext>;
}
