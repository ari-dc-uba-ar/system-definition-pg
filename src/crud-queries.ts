import { EntityInfo, RecordInfo, TypeCollection } from "system-definition";

import { EntityInfoMap } from "./entity-infos";
import { quoteIdent } from "./quoting";
import { SqlQuery } from "./sql-query";

function placeholder(values: unknown[], value: unknown): string {
    values.push(value);
    return '$' + values.length;
}

/* RecordInstanceType (system-definition) deduces the instance type of a RecordDef, but
   completeEntity's output is a RecordInfo: same 'type' per field, isName widened from the
   literal 'true' to boolean, which RecordDef doesn't accept. This is the RecordInfo
   equivalent: it only needs the 'type' of each field, so it works for both. */
export type InstanceType<TypeDefs extends TypeCollection, TFields extends RecordInfo<TypeDefs>> = {
    [K in keyof TFields]: TypeDefs[TFields[K]['type']]['tsType']
}

// a record can mark more than one field isName (e.g. "apellido" and "nombres" both naming a person)
function nameFieldsOf<TypeDefs extends TypeCollection>(fields: RecordInfo<TypeDefs>): string[] {
    return Object.entries(fields).filter(([, field]) => field.isName).map(([name]) => name);
}

type ReferredNameJoin = {
    fkName: string
    targetTable: string
    nameFields: string[]
    sourceToTargetFields: Readonly<Record<string, string>>
}

/* for every fk of the entity whose target has at least one field marked isName, resolves
   what to join: the fk name becomes the join alias (unique per entity, and what tells apart
   two fks to the same target, e.g. mesas.presidente / mesas.vocal -> docentes). fks whose
   target isn't in entityInfos, or whose target has no isName field, are silently skipped:
   not every entity has a human-readable name field (e.g. a pure join table might not). */
function referredNameJoins<TypeDefs extends TypeCollection>(
    entityInfo: EntityInfo<TypeDefs>, entityInfos: EntityInfoMap<TypeDefs>
): ReferredNameJoin[] {
    return Object.entries(entityInfo.fks).flatMap(([fkName, fk]) => {
        var target = entityInfos[fk.entity];
        var nameFields = target ? nameFieldsOf(target.fields) : [];
        return nameFields.length > 0 ? [{fkName, targetTable: fk.entity, nameFields, sourceToTargetFields: fk.fields}] : [];
    });
}

/* given an entity's Info (completeEntity(entityDef)), builds the select/insert/update/delete
   query generators for it. Every value goes through a $n placeholder: nothing is
   interpolated into the SQL text, so the result is safe to run as-is against any driver
   that accepts (text, values), inside a program or behind an HTTP endpoint.

   entityInfos (optional) is the rest of the system: when given, selectByPk/selectWhere
   LEFT JOIN every fk whose target has isName field(s), bringing each of them along, aliased
   as "<fkName><separator><nameField>" (e.g. "materias__denominacion" for cursos.fks.materias).

   RETURNING can only see the mutated table's own columns — it can't join. So instead of
   duplicating the join logic there, insert/updateByPk/deleteByPk fall back to RETURNING just
   the pk when a join would otherwise be needed; call selectByPk with that pk to get the same
   joined row selectByPk always returns. Two round trips, but one code path for the join.
   Unchanged (RETURNING *) when there's nothing to join. Typing the joined columns onto the
   result is left for later: for now this is a runtime-only convenience, same as every other
   query built here (SqlQuery has no row type). */
export function createCrudQueries<
    TypeDefs extends TypeCollection,
    const TEntityInfo extends EntityInfo<TypeDefs>,
>(tableName: string, entityInfo: TEntityInfo, entityInfos?: EntityInfoMap<TypeDefs>, separator: string = '__') {
    type Instance = InstanceType<TypeDefs, TEntityInfo['fields']>
    type PkFields = TEntityInfo['pk'][number] & keyof Instance
    type PkValues = Pick<Instance, PkFields>

    var nameJoins = entityInfos ? referredNameJoins(entityInfo, entityInfos) : [];

    function pkConditions(values: unknown[], pkValues: PkValues): string[] {
        var pkRecord: Record<string, unknown> = pkValues;
        return entityInfo.pk.map(name => quoteIdent(name) + ' = ' + placeholder(values, pkRecord[name]));
    }

    // the plain forms (no joins) keep emitting bare "*"/"table" exactly as before, unaffected by entityInfos
    function selectColumns(): string {
        if (nameJoins.length === 0) return '*';
        var referredColumns = nameJoins.flatMap(join => join.nameFields.map(nameField =>
            quoteIdent(join.fkName) + '.' + quoteIdent(nameField) + ' AS ' + quoteIdent(join.fkName + separator + nameField)
        ));
        return [quoteIdent(tableName) + '.*', ...referredColumns].join(', ');
    }

    function selectFrom(): string {
        if (nameJoins.length === 0) return quoteIdent(tableName);
        var joins = nameJoins.map(join => {
            var onClause = Object.entries(join.sourceToTargetFields)
                .map(([sourceField, targetField]) =>
                    quoteIdent(join.fkName) + '.' + quoteIdent(targetField) + ' = ' + quoteIdent(tableName) + '.' + quoteIdent(sourceField)
                )
                .join(' AND ');
            return ' LEFT JOIN ' + quoteIdent(join.targetTable) + ' AS ' + quoteIdent(join.fkName) + ' ON ' + onClause;
        });
        return quoteIdent(tableName) + joins.join('');
    }

    // once there's a join, the base table's own columns need qualifying: a self-referencing
    // fk (e.g. docentes.jefe -> docentes) puts two columns of the same name in scope
    function qualify(name: string): string {
        return nameJoins.length === 0 ? quoteIdent(name) : quoteIdent(tableName) + '.' + quoteIdent(name);
    }

    // "... RETURNING *;" when there's nothing to join (unchanged from before); when there is,
    // RETURNING can't join, so it falls back to just the pk — re-fetch with selectByPk(pk) for the joined row
    function returningClause(): string {
        return nameJoins.length === 0 ? ' RETURNING *;' : ' RETURNING ' + entityInfo.pk.map(quoteIdent).join(', ') + ';';
    }

    function selectByPk(pkValues: PkValues): SqlQuery {
        var values: unknown[] = [];
        var pkRecord: Record<string, unknown> = pkValues;
        var conditions = entityInfo.pk.map(name => qualify(name) + ' = ' + placeholder(values, pkRecord[name]));
        return {text: 'SELECT ' + selectColumns() + ' FROM ' + selectFrom() + ' WHERE ' + conditions.join(' AND ') + ';', values};
    }

    function selectWhere(filter: Partial<Instance> = {}): SqlQuery {
        var values: unknown[] = [];
        var conditions = Object.entries(filter)
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => value === null
                ? qualify(name) + ' IS NULL'
                : qualify(name) + ' = ' + placeholder(values, value));
        var whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return {text: 'SELECT ' + selectColumns() + ' FROM ' + selectFrom() + whereClause + ';', values};
    }

    function insert(record: Partial<Instance>): SqlQuery {
        var values: unknown[] = [];
        // fields left undefined are omitted from the statement, so a column DEFAULT (e.g. a serial pk) can apply
        var entries = Object.entries(record).filter(([, value]) => value !== undefined);
        if (entries.length === 0) {
            throw new Error('insert: no fields provided for "' + tableName + '"');
        }
        var columns = entries.map(([name]) => quoteIdent(name));
        var placeholders = entries.map(([, value]) => placeholder(values, value));
        return {
            text: 'INSERT INTO ' + quoteIdent(tableName) + ' (' + columns.join(', ') + ') VALUES (' + placeholders.join(', ') + ')' + returningClause(),
            values,
        };
    }

    function updateByPk(pkValues: PkValues, changes: Partial<Omit<Instance, PkFields>>): SqlQuery {
        var values: unknown[] = [];
        var entries = Object.entries(changes).filter(([, value]) => value !== undefined);
        if (entries.length === 0) {
            throw new Error('updateByPk: no fields to update for "' + tableName + '"');
        }
        var setClause = entries.map(([name, value]) => quoteIdent(name) + ' = ' + placeholder(values, value));
        var conditions = pkConditions(values, pkValues);
        return {
            text: 'UPDATE ' + quoteIdent(tableName) + ' SET ' + setClause.join(', ') + ' WHERE ' + conditions.join(' AND ') + returningClause(),
            values,
        };
    }

    function deleteByPk(pkValues: PkValues): SqlQuery {
        var values: unknown[] = [];
        var conditions = pkConditions(values, pkValues);
        return {text: 'DELETE FROM ' + quoteIdent(tableName) + ' WHERE ' + conditions.join(' AND ') + returningClause(), values};
    }

    return {selectByPk, selectWhere, insert, updateByPk, deleteByPk};
}

export type CrudQueries<TypeDefs extends TypeCollection, TEntityInfo extends EntityInfo<TypeDefs>> =
    ReturnType<typeof createCrudQueries<TypeDefs, TEntityInfo>>
