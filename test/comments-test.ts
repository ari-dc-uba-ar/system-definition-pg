import * as assert from "assert";
import { commonTypeDefs, completeEntity, defineEntity } from "system-definition";

import { generateCommentStatements } from "../src/generate-schema";

describe("generateCommentStatements", function(){
    it("emits a COMMENT ON COLUMN for fields with a description", function(){
        var docentes = defineEntity({
            pk: ['docente'],
            fields: {
                docente: {type: 'text'},
                jefe   : {type: 'text', description: 'jefe de cátedra (otro docente)'},
            },
        });
        var statements = generateCommentStatements('docentes', completeEntity(docentes));
        assert.deepStrictEqual(statements, [
            'COMMENT ON COLUMN "docentes"."jefe" IS \'jefe de cátedra (otro docente)\';',
        ]);
    })
    it("skips fields without a description", function(){
        var materias = defineEntity({pk: ['materia'], fields: {materia: {type: 'text'}}});
        assert.deepStrictEqual(generateCommentStatements('materias', completeEntity(materias)), []);
    })
    it("escapes single quotes inside the description", function(){
        var alumnos = defineEntity({
            pk: ['alumno'],
            fields: {alumno: {type: 'text', description: "alumno's legajo"}},
        });
        var statements = generateCommentStatements('alumnos', completeEntity(alumnos));
        assert.deepStrictEqual(statements, [
            'COMMENT ON COLUMN "alumnos"."alumno" IS \'alumno\'\'s legajo\';',
        ]);
    })
})
