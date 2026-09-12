import * as assert from "assert";
import { completeEntity, defineEntities, defineEntity, defineRecord, withRecords } from "system-definition";

import { generateForeignKeyStatements } from "../src/generate-schema";
import { testTypes } from "./test-system";

var context = withRecords(testTypes, {
    materia : defineRecord(testTypes, {materia: {type: 'text'}}),
    curso   : defineRecord(testTypes, {periodo: {type: 'text'}, materia: {type: 'text'}}),
    clase   : defineRecord(testTypes, {periodo: {type: 'text'}, materia: {type: 'text'}, orden: {type: 'integer'}}),
    docente : defineRecord(testTypes, {docente: {type: 'text'}, jefe: {type: 'text'}}),
    mesa    : defineRecord(testTypes, {mesa: {type: 'text'}, presidente: {type: 'text'}, vocal: {type: 'text'}}),
    periodo : defineRecord(testTypes, {periodo: {type: 'text'}}),
})

describe("generateForeignKeyStatements", function(){
    it("generates a simple fk (array form, same field names)", function(){
        var materias = defineEntity(context, {name: 'materias', record: 'materia', pk: ['materia']});
        var cursos = defineEntity(context, {
            name: 'cursos',
            record: 'curso',
            pk: ['periodo', 'materia'],
            fks: {materias: {entity: 'materias', fields: materias.pk}},
        });
        defineEntities({materias, cursos});
        var statements = generateForeignKeyStatements(context, completeEntity(context, cursos));
        assert.deepStrictEqual(statements, [
            'ALTER TABLE "cursos" ADD CONSTRAINT "fk_cursos_materias" FOREIGN KEY ("materia") REFERENCES "materias" ("materia");',
        ]);
    })
    it("generates a composite fk, one column pair per shared field", function(){
        var cursos = defineEntity(context, {name: 'cursos', record: 'curso', pk: ['periodo', 'materia']});
        var clases = defineEntity(context, {
            name: 'clases',
            record: 'clase',
            pk: ['periodo', 'materia', 'orden'],
            fks: {cursos: {entity: 'cursos', fields: cursos.pk}},
        });
        defineEntities({cursos, clases});
        var statements = generateForeignKeyStatements(context, completeEntity(context, clases));
        assert.deepStrictEqual(statements, [
            'ALTER TABLE "clases" ADD CONSTRAINT "fk_clases_cursos" FOREIGN KEY ("periodo", "materia") REFERENCES "cursos" ("periodo", "materia");',
        ]);
    })
    it("generates a reflexive fk (an entity referencing itself)", function(){
        var docentes = defineEntity(context, {
            name: 'docentes',
            record: 'docente',
            pk: ['docente'],
            fks: {jefe: {entity: 'docentes', fields: {jefe: 'docente'}}},
        });
        defineEntities({docentes});
        var statements = generateForeignKeyStatements(context, completeEntity(context, docentes));
        assert.deepStrictEqual(statements, [
            'ALTER TABLE "docentes" ADD CONSTRAINT "fk_docentes_jefe" FOREIGN KEY ("jefe") REFERENCES "docentes" ("docente");',
        ]);
    })
    it("generates two distinct fks to the same target entity, with renamed fields", function(){
        var docentes = defineEntity(context, {name: 'docentes', record: 'docente', pk: ['docente']});
        var mesas = defineEntity(context, {
            name: 'mesas',
            record: 'mesa',
            pk: ['mesa'],
            fks: {
                presidente: {entity: 'docentes', fields: {presidente: 'docente'}},
                vocal     : {entity: 'docentes', fields: {vocal: 'docente'}},
            },
        });
        defineEntities({docentes, mesas});
        var statements = generateForeignKeyStatements(context, completeEntity(context, mesas));
        assert.deepStrictEqual(statements, [
            'ALTER TABLE "mesas" ADD CONSTRAINT "fk_mesas_presidente" FOREIGN KEY ("presidente") REFERENCES "docentes" ("docente");',
            'ALTER TABLE "mesas" ADD CONSTRAINT "fk_mesas_vocal" FOREIGN KEY ("vocal") REFERENCES "docentes" ("docente");',
        ]);
    })
    it("returns an empty array for an entity without fks", function(){
        var periodos = defineEntity(context, {name: 'periodos', record: 'periodo', pk: ['periodo']});
        assert.deepStrictEqual(generateForeignKeyStatements(context, completeEntity(context, periodos)), []);
    })
})
