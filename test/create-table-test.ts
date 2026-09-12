import * as assert from "assert";
import { completeEntity, defineEntity, defineRecord, withRecords } from "system-definition";

import { PgTypeMap } from "../src/pg-type-map";
import { generateCreateTableStatement } from "../src/generate-schema";
import { testPgTypeMap, testTypes } from "./test-system";

var pgTypeMap: PgTypeMap<typeof testTypes> = testPgTypeMap;

describe("generateCreateTableStatement", function(){
    it("maps each field's type through the pg type map, quoting names", function(){
        var context = withRecords(testTypes, {
            materia: defineRecord(testTypes, {
                materia     : {type: 'text'},
                creditos    : {type: 'integer'},
                obligatoria : {type: 'boolean'},
            }),
        });
        var materias = defineEntity(context, {name: 'materias', record: 'materia', pk: ['materia']});
        var sql = generateCreateTableStatement(context, completeEntity(context, materias), pgTypeMap);
        assert.equal(sql,
            'CREATE TABLE "materias" (\n' +
            '    "materia" text NOT NULL,\n' +
            '    "creditos" integer,\n' +
            '    "obligatoria" boolean,\n' +
            '    PRIMARY KEY ("materia")\n' +
            ');'
        );
    })
    it("adds NOT NULL only for fields declared non-nullable", function(){
        var context = withRecords(testTypes, {
            alumno: defineRecord(testTypes, {
                alumno  : {type: 'text'},
                apellido: {type: 'text', nullable: false},
                nombres : {type: 'text'},
            }),
        });
        var alumnos = defineEntity(context, {name: 'alumnos', record: 'alumno', pk: ['alumno']});
        var sql = generateCreateTableStatement(context, completeEntity(context, alumnos), pgTypeMap);
        assert.match(sql, /"apellido" text NOT NULL,\n/);
        assert.match(sql, /"nombres" text,\n/);
    })
    it("makes the pk columns NOT NULL even though the record does not say so", function(){
        var context = withRecords(testTypes, {
            alumno: defineRecord(testTypes, {alumno: {type: 'text'}, nombres: {type: 'text'}}),
        });
        var alumnos = defineEntity(context, {name: 'alumnos', record: 'alumno', pk: ['alumno']});
        var sql = generateCreateTableStatement(context, completeEntity(context, alumnos), pgTypeMap);
        assert.match(sql, /"alumno" text NOT NULL,\n/);
    })
    it("generates a composite PRIMARY KEY preserving field order", function(){
        var context = withRecords(testTypes, {
            curso: defineRecord(testTypes, {periodo: {type: 'text'}, materia: {type: 'text'}}),
        });
        var cursos = defineEntity(context, {name: 'cursos', record: 'curso', pk: ['periodo', 'materia']});
        var sql = generateCreateTableStatement(context, completeEntity(context, cursos), pgTypeMap);
        assert.match(sql, /PRIMARY KEY \("periodo", "materia"\)/);
    })
    it("adds a named UNIQUE constraint per uk", function(){
        var context = withRecords(testTypes, {
            materia: defineRecord(testTypes, {materia: {type: 'text'}, denominacion: {type: 'text'}}),
        });
        var materias = defineEntity(context, {
            name: 'materias',
            record: 'materia',
            pk: ['materia'],
            uks: {denominacion: ['denominacion']},
        });
        var sql = generateCreateTableStatement(context, completeEntity(context, materias), pgTypeMap);
        assert.match(sql, /CONSTRAINT "uk_materias_denominacion" UNIQUE \("denominacion"\)/);
    })
})
