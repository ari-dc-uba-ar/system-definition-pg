import * as assert from "assert";
import { commonTypeDefs, defineEntities, defineEntity } from "system-definition";

import { PgTypeMap } from "../src/pg-type-map";
import { generateDatabaseScript } from "../src/generate-schema";

var pgTypeMap: PgTypeMap<typeof commonTypeDefs> = {
    text: 'text',
    integer: 'integer',
    boolean: 'boolean',
}

describe("generateDatabaseScript", function(){
    it("assembles CREATE TABLEs, then fks, then comments, in that order", function(){
        var materias = defineEntity({
            pk: ['materia'],
            uks: {denominacion: ['denominacion']},
            fields: {
                materia     : {type: 'text'},
                denominacion: {type: 'text', description: 'nombre público de la materia'},
            },
        });
        var cursos = defineEntity({
            pk: ['periodo', 'materia'],
            fks: {materias: {entity: 'materias', fields: materias.pk}},
            fields: {periodo: {type: 'text'}, materia: {type: 'text'}},
        });
        var entityDefs = defineEntities({materias, cursos});
        var script = generateDatabaseScript(entityDefs, pgTypeMap);

        var createTableIdx = script.indexOf('CREATE TABLE "materias"');
        var alterTableIdx = script.indexOf('ALTER TABLE "cursos"');
        var commentIdx = script.indexOf('COMMENT ON COLUMN');
        assert.ok(createTableIdx >= 0 && alterTableIdx > createTableIdx && commentIdx > alterTableIdx,
            'expected CREATE TABLE, then ALTER TABLE (fks), then COMMENT, in that order');
        assert.match(script, /CONSTRAINT "uk_materias_denominacion" UNIQUE \("denominacion"\)/);
        assert.ok(script.endsWith('\n'));
    })
    it("produces a script with no fk or comment sections when none are needed", function(){
        var periodos = defineEntity({pk: ['periodo'], fields: {periodo: {type: 'text'}}});
        var entityDefs = defineEntities({periodos});
        var script = generateDatabaseScript(entityDefs, pgTypeMap);
        assert.equal(script,
            'CREATE TABLE "periodos" (\n    "periodo" text,\n    PRIMARY KEY ("periodo")\n);\n'
        );
    })
})
