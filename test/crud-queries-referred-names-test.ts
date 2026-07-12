import * as assert from "assert";
import { completeEntity, defineEntities, defineEntity } from "system-definition";

import { completeEntities } from "../src/entity-infos";
import { createCrudQueries } from "../src/crud-queries";

var materias = defineEntity({
    pk: ['materia'],
    fields: {
        materia     : {type: 'text'},
        denominacion: {type: 'text', isName: true},
    },
})
var periodos = defineEntity({
    // no isName field: periodos has nothing to refer to by name
    pk: ['periodo'],
    fields: {periodo: {type: 'text'}},
})
var cursos = defineEntity({
    pk: ['periodo', 'materia'],
    fks: {
        periodos: {entity: 'periodos', fields: periodos.pk},
        materias: {entity: 'materias', fields: materias.pk},
    },
    fields: {periodo: {type: 'text'}, materia: {type: 'text'}},
})
var docentes = defineEntity({
    pk: ['docente'],
    fks: {jefe: {entity: 'docentes', fields: {jefe: 'docente'}}},
    fields: {
        docente: {type: 'text'},
        nombre : {type: 'text', isName: true},
        jefe   : {type: 'text'},
    },
})
var mesas = defineEntity({
    pk: ['mesa'],
    fks: {
        presidente: {entity: 'docentes', fields: {presidente: 'docente'}},
        vocal     : {entity: 'docentes', fields: {vocal: 'docente'}},
    },
    fields: {mesa: {type: 'text'}, presidente: {type: 'text'}, vocal: {type: 'text'}},
})
var entityDefs = defineEntities({materias, periodos, cursos, docentes, mesas});
var entityInfos = completeEntities(entityDefs);

describe("createCrudQueries: referred isName joins", function(){
    it("without entityInfos, select stays exactly as before (no joins)", function(){
        var queries = createCrudQueries('cursos', entityInfos.cursos);
        assert.deepStrictEqual(queries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'}), {
            text: 'SELECT * FROM "cursos" WHERE "periodo" = $1 AND "materia" = $2;',
            values: ['2026-1c', 'AlgoI'],
        });
    })
    it("joins only the fks whose target has an isName field, aliasing by fk name", function(){
        var queries = createCrudQueries('cursos', entityInfos.cursos, entityInfos);
        var query = queries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "cursos".*, "materias"."denominacion" AS "materias__denominacion"'
                + ' FROM "cursos" LEFT JOIN "materias" AS "materias" ON "materias"."materia" = "cursos"."materia"'
                + ' WHERE "cursos"."periodo" = $1 AND "cursos"."materia" = $2;',
            values: ['2026-1c', 'AlgoI'],
        });
        // periodos has no isName field: its fk is not joined, even though it's present in entityInfos
        assert.ok(!query.text.includes('periodos'));
    })
    it("also enriches selectWhere, qualifying the base entity's own fields", function(){
        var queries = createCrudQueries('cursos', entityInfos.cursos, entityInfos);
        var query = queries.selectWhere({materia: 'AlgoI'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "cursos".*, "materias"."denominacion" AS "materias__denominacion"'
                + ' FROM "cursos" LEFT JOIN "materias" AS "materias" ON "materias"."materia" = "cursos"."materia"'
                + ' WHERE "cursos"."materia" = $1;',
            values: ['AlgoI'],
        });
    })
    it("gives two fks to the same target entity distinct join aliases and column aliases", function(){
        var queries = createCrudQueries('mesas', entityInfos.mesas, entityInfos);
        var query = queries.selectByPk({mesa: 'M1'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "mesas".*, "presidente"."nombre" AS "presidente__nombre", "vocal"."nombre" AS "vocal__nombre"'
                + ' FROM "mesas"'
                + ' LEFT JOIN "docentes" AS "presidente" ON "presidente"."docente" = "mesas"."presidente"'
                + ' LEFT JOIN "docentes" AS "vocal" ON "vocal"."docente" = "mesas"."vocal"'
                + ' WHERE "mesas"."mesa" = $1;',
            values: ['M1'],
        });
    })
    it("handles a reflexive fk (self-join) without ambiguity, qualifying the base column", function(){
        var queries = createCrudQueries('docentes', entityInfos.docentes, entityInfos);
        var query = queries.selectByPk({docente: 'D2'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "docentes".*, "jefe"."nombre" AS "jefe__nombre"'
                + ' FROM "docentes" LEFT JOIN "docentes" AS "jefe" ON "jefe"."docente" = "docentes"."jefe"'
                + ' WHERE "docentes"."docente" = $1;',
            values: ['D2'],
        });
    })
    it("skips a fk whose target entity isn't present in entityInfos", function(){
        var partialEntityInfos = {materias: entityInfos.materias};
        var queries = createCrudQueries('cursos', entityInfos.cursos, partialEntityInfos);
        // only the materias fk can be resolved; the periodos fk's target is missing, so it's skipped too (it has no isName anyway)
        var query = queries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'});
        assert.match(query.text, /"materias__denominacion"/);
    })
    it("accepts a custom separator for the joined column alias", function(){
        var queries = createCrudQueries('cursos', entityInfos.cursos, entityInfos, '.');
        var query = queries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'});
        assert.match(query.text, /"materias"."denominacion" AS "materias\.denominacion"/);
    })
    it("leaves insert/update/delete untouched even when entityInfos is given", function(){
        var queries = createCrudQueries('cursos', entityInfos.cursos, entityInfos);
        assert.deepStrictEqual(queries.deleteByPk({periodo: '2026-1c', materia: 'AlgoI'}), {
            text: 'DELETE FROM "cursos" WHERE "periodo" = $1 AND "materia" = $2 RETURNING *;',
            values: ['2026-1c', 'AlgoI'],
        });
    })
})
