import * as assert from "assert";
import { completeEntity, defineEntities, defineEntity } from "system-definition";

import { generateForeignKeyStatements } from "../src/generate-schema";

describe("generateForeignKeyStatements", function(){
    it("generates a simple fk (array form, same field names)", function(){
        var materias = defineEntity({pk: ['materia'], fields: {materia: {type: 'text'}}});
        var cursos = defineEntity({
            pk: ['periodo', 'materia'],
            fks: {materias: {entity: 'materias', fields: materias.pk}},
            fields: {periodo: {type: 'text'}, materia: {type: 'text'}},
        });
        defineEntities({materias, cursos});
        var statements = generateForeignKeyStatements('cursos', completeEntity(cursos));
        assert.deepStrictEqual(statements, [
            'ALTER TABLE "cursos" ADD CONSTRAINT "fk_cursos_materias" FOREIGN KEY ("materia") REFERENCES "materias" ("materia");',
        ]);
    })
    it("generates a composite fk, one column pair per shared field", function(){
        var cursos = defineEntity({
            pk: ['periodo', 'materia'],
            fields: {periodo: {type: 'text'}, materia: {type: 'text'}},
        });
        var clases = defineEntity({
            pk: ['periodo', 'materia', 'orden'],
            fks: {cursos: {entity: 'cursos', fields: cursos.pk}},
            fields: {periodo: {type: 'text'}, materia: {type: 'text'}, orden: {type: 'integer'}},
        });
        defineEntities({cursos, clases});
        var statements = generateForeignKeyStatements('clases', completeEntity(clases));
        assert.deepStrictEqual(statements, [
            'ALTER TABLE "clases" ADD CONSTRAINT "fk_clases_cursos" FOREIGN KEY ("periodo", "materia") REFERENCES "cursos" ("periodo", "materia");',
        ]);
    })
    it("generates a reflexive fk (an entity referencing itself)", function(){
        var docentes = defineEntity({
            pk: ['docente'],
            fks: {jefe: {entity: 'docentes', fields: {jefe: 'docente'}}},
            fields: {docente: {type: 'text'}, jefe: {type: 'text'}},
        });
        defineEntities({docentes});
        var statements = generateForeignKeyStatements('docentes', completeEntity(docentes));
        assert.deepStrictEqual(statements, [
            'ALTER TABLE "docentes" ADD CONSTRAINT "fk_docentes_jefe" FOREIGN KEY ("jefe") REFERENCES "docentes" ("docente");',
        ]);
    })
    it("generates two distinct fks to the same target entity, with renamed fields", function(){
        var docentes = defineEntity({pk: ['docente'], fields: {docente: {type: 'text'}}});
        var mesas = defineEntity({
            pk: ['mesa'],
            fks: {
                presidente: {entity: 'docentes', fields: {presidente: 'docente'}},
                vocal     : {entity: 'docentes', fields: {vocal: 'docente'}},
            },
            fields: {mesa: {type: 'text'}, presidente: {type: 'text'}, vocal: {type: 'text'}},
        });
        defineEntities({docentes, mesas});
        var statements = generateForeignKeyStatements('mesas', completeEntity(mesas));
        assert.deepStrictEqual(statements, [
            'ALTER TABLE "mesas" ADD CONSTRAINT "fk_mesas_presidente" FOREIGN KEY ("presidente") REFERENCES "docentes" ("docente");',
            'ALTER TABLE "mesas" ADD CONSTRAINT "fk_mesas_vocal" FOREIGN KEY ("vocal") REFERENCES "docentes" ("docente");',
        ]);
    })
    it("returns an empty array for an entity without fks", function(){
        var periodos = defineEntity({pk: ['periodo'], fields: {periodo: {type: 'text'}}});
        assert.deepStrictEqual(generateForeignKeyStatements('periodos', completeEntity(periodos)), []);
    })
})
