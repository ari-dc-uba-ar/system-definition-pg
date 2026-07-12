import { EntityDef, EntityInfo, TypeCollection, completeEntity } from "system-definition";

/* a whole system's entities, already completed (Def -> Info): what generators that need to
   look across entities (e.g. resolving what a foreign key points at) consume. */
export type EntityInfoMap<TypeDefs extends TypeCollection> = Record<string, EntityInfo<TypeDefs>>

export function completeEntities<TypeDefs extends TypeCollection>(
    entityDefs: Record<string, EntityDef<TypeDefs>>
): EntityInfoMap<TypeDefs> {
    return Object.fromEntries(
        Object.entries(entityDefs).map(([name, entityDef]) => [name, completeEntity(entityDef as EntityDef<TypeCollection>)])
    ) as EntityInfoMap<TypeDefs>;
}
