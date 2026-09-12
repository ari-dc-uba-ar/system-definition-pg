import { EntityDef, EntityInfo, FieldInfo } from "system-definition";

import { completeEntities } from "./entity-infos";
import { PgContext } from "./pg-context";
import { PgTypeMap } from "./pg-type-map";
import { quoteIdent, quoteLiteral } from "./quoting";

/* every entry point takes the context of the system it is generating for, as first argument
   and before anything else, the same way completeEntity does. Nothing reads it at runtime
   (hence the _ in the ones that only need it as a type): it is there so the compiler resolves
   which types the system has — so the map can be checked exhaustive and each field's type is
   a key of it — and what a completed field of that system carries.
   The name of the column and the name of the table stopped being parameters: the Info says
   its own name, which is exactly what that denormalization is for.
   Every other parameter is NoInfer: the context is the only place the compiler should read
   the system from. Without it a PgTypeMap argument reverse-infers a context of its own that
   wins over the real one, and the field def of THAT context is never — which shows up much
   later as an unrelated-looking error on the entity defs. */

export function columnDefinitionLine<TContext extends PgContext<TContext>>(
    _context: TContext, field: FieldInfo<NoInfer<TContext>>, pgTypeMap: PgTypeMap<NoInfer<TContext>>
): string {
    var pgType = pgTypeMap[field.type];
    return quoteIdent(field.name) + ' ' + pgType + (field.nullable ? '' : ' NOT NULL');
}

export function generateCreateTableStatement<TContext extends PgContext<TContext>>(
    context: TContext, entityInfo: EntityInfo<NoInfer<TContext>>, pgTypeMap: PgTypeMap<NoInfer<TContext>>
): string {
    var tableName = entityInfo.name;
    var columnLines = Object.values(entityInfo.fields).map(field => columnDefinitionLine(context, field, pgTypeMap));
    var pkLine = 'PRIMARY KEY (' + entityInfo.pk.map(quoteIdent).join(', ') + ')';
    var ukLines = Object.entries(entityInfo.uks).map(([ukName, fields]) =>
        'CONSTRAINT ' + quoteIdent('uk_' + tableName + '_' + ukName) + ' UNIQUE (' + fields.map(quoteIdent).join(', ') + ')'
    );
    var lines = [...columnLines, pkLine, ...ukLines];
    return 'CREATE TABLE ' + quoteIdent(tableName) + ' (\n    ' + lines.join(',\n    ') + '\n);';
}

export function generateForeignKeyStatements<TContext extends PgContext<TContext>>(
    _context: TContext, entityInfo: EntityInfo<NoInfer<TContext>>
): string[] {
    var tableName = entityInfo.name;
    return Object.entries(entityInfo.fks).map(([fkName, fk]) => {
        var sourceFields = Object.keys(fk.fields);
        var targetFields = Object.values(fk.fields);
        return 'ALTER TABLE ' + quoteIdent(tableName)
            + ' ADD CONSTRAINT ' + quoteIdent('fk_' + tableName + '_' + fkName)
            + ' FOREIGN KEY (' + sourceFields.map(quoteIdent).join(', ') + ')'
            + ' REFERENCES ' + quoteIdent(fk.entity) + ' (' + targetFields.map(quoteIdent).join(', ') + ');';
    });
}

export function generateCommentStatements<TContext extends PgContext<TContext>>(
    _context: TContext, entityInfo: EntityInfo<NoInfer<TContext>>
): string[] {
    var tableName = entityInfo.name;
    return Object.values(entityInfo.fields)
        .filter(field => field.description !== '')
        .map(field =>
            'COMMENT ON COLUMN ' + quoteIdent(tableName) + '.' + quoteIdent(field.name) + ' IS ' + quoteLiteral(field.description) + ';'
        );
}

export function generateDatabaseScript<TContext extends PgContext<TContext>>(
    context: TContext, entityDefs: Record<string, EntityDef<NoInfer<TContext>>>, pgTypeMap: PgTypeMap<NoInfer<TContext>>
): string {
    var infos = Object.values(completeEntities(context, entityDefs));
    var createTables = infos.map(info => generateCreateTableStatement(context, info, pgTypeMap));
    var foreignKeys = infos.flatMap(info => generateForeignKeyStatements(context, info));
    var comments = infos.flatMap(info => generateCommentStatements(context, info));
    var sections = [createTables, foreignKeys, comments].filter(section => section.length > 0);
    return sections.map(section => section.join('\n\n')).join('\n\n') + '\n';
}
