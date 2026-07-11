import {
    EntityDef, EntityInfo, FieldInfo, TypeCollection, completeEntity,
} from "system-definition";

import { PgTypeMap } from "./pg-type-map";
import { quoteIdent, quoteLiteral } from "./quoting";

export function columnDefinitionLine<TypeDefs extends TypeCollection>(
    name: string, field: FieldInfo<TypeDefs>, pgTypeMap: PgTypeMap<TypeDefs>
): string {
    var pgType = pgTypeMap[field.type];
    return quoteIdent(name) + ' ' + pgType + (field.nullable ? '' : ' NOT NULL');
}

export function generateCreateTableStatement<TypeDefs extends TypeCollection>(
    tableName: string, entityInfo: EntityInfo<TypeDefs>, pgTypeMap: PgTypeMap<TypeDefs>
): string {
    var columnLines = Object.entries(entityInfo.fields).map(
        ([name, field]) => columnDefinitionLine(name, field, pgTypeMap)
    );
    var pkLine = 'PRIMARY KEY (' + entityInfo.pk.map(quoteIdent).join(', ') + ')';
    var ukLines = Object.entries(entityInfo.uks).map(([ukName, fields]) =>
        'CONSTRAINT ' + quoteIdent('uk_' + tableName + '_' + ukName) + ' UNIQUE (' + fields.map(quoteIdent).join(', ') + ')'
    );
    var lines = [...columnLines, pkLine, ...ukLines];
    return 'CREATE TABLE ' + quoteIdent(tableName) + ' (\n    ' + lines.join(',\n    ') + '\n);';
}

export function generateForeignKeyStatements<TypeDefs extends TypeCollection>(
    tableName: string, entityInfo: EntityInfo<TypeDefs>
): string[] {
    return Object.entries(entityInfo.fks).map(([fkName, fk]) => {
        var sourceFields = Object.keys(fk.fields);
        var targetFields = Object.values(fk.fields);
        return 'ALTER TABLE ' + quoteIdent(tableName)
            + ' ADD CONSTRAINT ' + quoteIdent('fk_' + tableName + '_' + fkName)
            + ' FOREIGN KEY (' + sourceFields.map(quoteIdent).join(', ') + ')'
            + ' REFERENCES ' + quoteIdent(fk.entity) + ' (' + targetFields.map(quoteIdent).join(', ') + ');';
    });
}

export function generateCommentStatements<TypeDefs extends TypeCollection>(
    tableName: string, entityInfo: EntityInfo<TypeDefs>
): string[] {
    return Object.entries(entityInfo.fields)
        .filter(([, field]) => field.description !== '')
        .map(([name, field]) =>
            'COMMENT ON COLUMN ' + quoteIdent(tableName) + '.' + quoteIdent(name) + ' IS ' + quoteLiteral(field.description) + ';'
        );
}

export function generateDatabaseScript<TypeDefs extends TypeCollection>(
    entityDefs: Record<string, EntityDef<TypeDefs>>, pgTypeMap: PgTypeMap<TypeDefs>
): string {
    var entities = Object.entries(entityDefs).map(
        ([name, entityDef]) => [name, completeEntity(entityDef as EntityDef<TypeCollection>)] as [string, EntityInfo<TypeDefs>]
    );
    var createTables = entities.map(([name, info]) => generateCreateTableStatement(name, info, pgTypeMap));
    var foreignKeys = entities.flatMap(([name, info]) => generateForeignKeyStatements(name, info));
    var comments = entities.flatMap(([name, info]) => generateCommentStatements(name, info));
    var sections = [createTables, foreignKeys, comments].filter(section => section.length > 0);
    return sections.map(section => section.join('\n\n')).join('\n\n') + '\n';
}
