import * as assert from "assert";
import { defineEntities, defineEntity, defineRecord, withRecords } from "system-definition";

import { PgTypeMap } from "../src/pg-type-map";
import { generateDatabaseScript } from "../src/generate-schema";
import { testPgTypeMap, testTypes } from "./test-system";

var pgTypeMap: PgTypeMap<typeof testTypes> = testPgTypeMap;

describe("generateDatabaseScript", function(){
    it("assembles CREATE TABLEs, then fks, then comments, in that order", function(){
        var context = withRecords(testTypes, {
            materia: defineRecord(testTypes, {
                materia     : {type: 'text'},
                denominacion: {type: 'text', description: 'nombre público de la materia'},
            }),
            curso: defineRecord(testTypes, {periodo: {type: 'text'}, materia: {type: 'text'}}),
        });
        var materias = defineEntity(context, {
            name: 'materias',
            record: 'materia',
            pk: ['materia'],
            uks: {denominacion: ['denominacion']},
        });
        var cursos = defineEntity(context, {
            name: 'cursos',
            record: 'curso',
            pk: ['periodo', 'materia'],
            fks: {materias: {entity: 'materias', fields: materias.pk}},
        });
        var entityDefs = defineEntities({materias, cursos});
        var script = generateDatabaseScript(context, entityDefs, pgTypeMap);

        var createTableIdx = script.indexOf('CREATE TABLE "materias"');
        var alterTableIdx = script.indexOf('ALTER TABLE "cursos"');
        var commentIdx = script.indexOf('COMMENT ON COLUMN');
        assert.ok(createTableIdx >= 0 && alterTableIdx > createTableIdx && commentIdx > alterTableIdx,
            'expected CREATE TABLE, then ALTER TABLE (fks), then COMMENT, in that order');
        assert.match(script, /CONSTRAINT "uk_materias_denominacion" UNIQUE \("denominacion"\)/);
        assert.ok(script.endsWith('\n'));
    })
    it("produces a script with no fk or comment sections when none are needed", function(){
        var context = withRecords(testTypes, {
            periodo: defineRecord(testTypes, {periodo: {type: 'text'}}),
        });
        var periodos = defineEntity(context, {name: 'periodos', record: 'periodo', pk: ['periodo']});
        var entityDefs = defineEntities({periodos});
        var script = generateDatabaseScript(context, entityDefs, pgTypeMap);
        assert.equal(script,
            'CREATE TABLE "periodos" (\n    "periodo" text NOT NULL,\n    PRIMARY KEY ("periodo")\n);\n'
        );
    })
})
