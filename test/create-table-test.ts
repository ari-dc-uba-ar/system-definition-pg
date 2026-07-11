import * as assert from "assert";
import { commonTypeDefs, completeEntity, defineEntity } from "system-definition";

import { PgTypeMap } from "../src/pg-type-map";
import { generateCreateTableStatement } from "../src/generate-schema";

var pgTypeMap: PgTypeMap<typeof commonTypeDefs> = {
    text: 'text',
    integer: 'integer',
    boolean: 'boolean',
}

describe("generateCreateTableStatement", function(){
    it("maps each field's type through the pg type map, quoting names", function(){
        var materias = defineEntity({
            pk: ['materia'],
            fields: {
                materia     : {type: 'text'},
                creditos    : {type: 'integer'},
                obligatoria : {type: 'boolean'},
            },
        });
        var sql = generateCreateTableStatement('materias', completeEntity(materias), pgTypeMap);
        assert.equal(sql,
            'CREATE TABLE "materias" (\n' +
            '    "materia" text,\n' +
            '    "creditos" integer,\n' +
            '    "obligatoria" boolean,\n' +
            '    PRIMARY KEY ("materia")\n' +
            ');'
        );
    })
    it("adds NOT NULL only for fields declared non-nullable", function(){
        var alumnos = defineEntity({
            pk: ['alumno'],
            fields: {
                alumno  : {type: 'text'},
                apellido: {type: 'text', nullable: false},
            },
        });
        var sql = generateCreateTableStatement('alumnos', completeEntity(alumnos), pgTypeMap);
        assert.match(sql, /"alumno" text,\n/);
        assert.match(sql, /"apellido" text NOT NULL,\n/);
    })
    it("generates a composite PRIMARY KEY preserving field order", function(){
        var cursos = defineEntity({
            pk: ['periodo', 'materia'],
            fields: {
                periodo: {type: 'text'},
                materia: {type: 'text'},
            },
        });
        var sql = generateCreateTableStatement('cursos', completeEntity(cursos), pgTypeMap);
        assert.match(sql, /PRIMARY KEY \("periodo", "materia"\)/);
    })
    it("adds a named UNIQUE constraint per uk", function(){
        var materias = defineEntity({
            pk: ['materia'],
            uks: {denominacion: ['denominacion']},
            fields: {
                materia     : {type: 'text'},
                denominacion: {type: 'text'},
            },
        });
        var sql = generateCreateTableStatement('materias', completeEntity(materias), pgTypeMap);
        assert.match(sql, /CONSTRAINT "uk_materias_denominacion" UNIQUE \("denominacion"\)/);
    })
})
