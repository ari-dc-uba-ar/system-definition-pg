import * as assert from "assert";
import { completeEntity, defineEntity, defineRecord, withRecords } from "system-definition";

import { generateCommentStatements } from "../src/generate-schema";
import { testTypes } from "./test-system";

describe("generateCommentStatements", function(){
    it("emits a COMMENT ON COLUMN for fields with a description", function(){
        var context = withRecords(testTypes, {
            docente: defineRecord(testTypes, {
                docente: {type: 'text'},
                jefe   : {type: 'text', description: 'jefe de cátedra (otro docente)'},
            }),
        });
        var docentes = defineEntity(context, {name: 'docentes', record: 'docente', pk: ['docente']});
        var statements = generateCommentStatements(context, completeEntity(context, docentes));
        assert.deepStrictEqual(statements, [
            'COMMENT ON COLUMN "docentes"."jefe" IS \'jefe de cátedra (otro docente)\';',
        ]);
    })
    it("skips fields without a description", function(){
        var context = withRecords(testTypes, {
            materia: defineRecord(testTypes, {materia: {type: 'text'}}),
        });
        var materias = defineEntity(context, {name: 'materias', record: 'materia', pk: ['materia']});
        assert.deepStrictEqual(generateCommentStatements(context, completeEntity(context, materias)), []);
    })
    it("escapes single quotes inside the description", function(){
        var context = withRecords(testTypes, {
            alumno: defineRecord(testTypes, {alumno: {type: 'text', description: "alumno's legajo"}}),
        });
        var alumnos = defineEntity(context, {name: 'alumnos', record: 'alumno', pk: ['alumno']});
        var statements = generateCommentStatements(context, completeEntity(context, alumnos));
        assert.deepStrictEqual(statements, [
            'COMMENT ON COLUMN "alumnos"."alumno" IS \'alumno\'\'s legajo\';',
        ]);
    })
})
