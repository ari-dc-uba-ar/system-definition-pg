import { EntityInfo, RecordInfo, TypeCollection } from "system-definition";

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

/* given an entity's Info (completeEntity(entityDef)), builds the select/insert/update/delete
   query generators for it. Every value goes through a $n placeholder: nothing is
   interpolated into the SQL text, so the result is safe to run as-is against any driver
   that accepts (text, values), inside a program or behind an HTTP endpoint. */
export function createCrudQueries<
    TypeDefs extends TypeCollection,
    const TEntityInfo extends EntityInfo<TypeDefs>,
>(tableName: string, entityInfo: TEntityInfo) {
    type Instance = InstanceType<TypeDefs, TEntityInfo['fields']>
    type PkFields = TEntityInfo['pk'][number] & keyof Instance
    type PkValues = Pick<Instance, PkFields>

    function pkConditions(values: unknown[], pkValues: PkValues): string[] {
        var pkRecord: Record<string, unknown> = pkValues;
        return entityInfo.pk.map(name => quoteIdent(name) + ' = ' + placeholder(values, pkRecord[name]));
    }

    function selectByPk(pkValues: PkValues): SqlQuery {
        var values: unknown[] = [];
        var conditions = pkConditions(values, pkValues);
        return {text: 'SELECT * FROM ' + quoteIdent(tableName) + ' WHERE ' + conditions.join(' AND ') + ';', values};
    }

    function selectWhere(filter: Partial<Instance> = {}): SqlQuery {
        var values: unknown[] = [];
        var conditions = Object.entries(filter)
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => value === null
                ? quoteIdent(name) + ' IS NULL'
                : quoteIdent(name) + ' = ' + placeholder(values, value));
        var whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return {text: 'SELECT * FROM ' + quoteIdent(tableName) + whereClause + ';', values};
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
            text: 'INSERT INTO ' + quoteIdent(tableName) + ' (' + columns.join(', ') + ') VALUES (' + placeholders.join(', ') + ') RETURNING *;',
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
            text: 'UPDATE ' + quoteIdent(tableName) + ' SET ' + setClause.join(', ') + ' WHERE ' + conditions.join(' AND ') + ' RETURNING *;',
            values,
        };
    }

    function deleteByPk(pkValues: PkValues): SqlQuery {
        var values: unknown[] = [];
        var conditions = pkConditions(values, pkValues);
        return {text: 'DELETE FROM ' + quoteIdent(tableName) + ' WHERE ' + conditions.join(' AND ') + ' RETURNING *;', values};
    }

    return {selectByPk, selectWhere, insert, updateByPk, deleteByPk};
}

export type CrudQueries<TypeDefs extends TypeCollection, TEntityInfo extends EntityInfo<TypeDefs>> =
    ReturnType<typeof createCrudQueries<TypeDefs, TEntityInfo>>
