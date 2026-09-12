import * as assert from "assert";
import { defineEntities, defineEntity, defineRecord, withRecords } from "system-definition";

import { completeEntities } from "../src/entity-infos";
import { createCrudQueries } from "../src/crud-queries";
import { testTypes } from "./test-system";

var context = withRecords(testTypes, {
    materia: defineRecord(testTypes, {
        materia     : {type: 'text'},
        denominacion: {type: 'text', isName: true},
    }),
    // no isName field: periodos has nothing to refer to by name
    periodo: defineRecord(testTypes, {periodo: {type: 'text'}}),
    curso  : defineRecord(testTypes, {periodo: {type: 'text'}, materia: {type: 'text'}}),
    docente: defineRecord(testTypes, {
        docente: {type: 'text'},
        nombre : {type: 'text', isName: true},
        jefe   : {type: 'text'},
    }),
    mesa   : defineRecord(testTypes, {mesa: {type: 'text'}, presidente: {type: 'text'}, vocal: {type: 'text'}}),
    persona: defineRecord(testTypes, {
        persona : {type: 'text'},
        // a record can mark more than one field isName (e.g. a person's surname and first name)
        apellido: {type: 'text', isName: true},
        nombres : {type: 'text', isName: true},
    }),
    cita   : defineRecord(testTypes, {cita: {type: 'text'}, persona: {type: 'text'}}),
})

var materias = defineEntity(context, {name: 'materias', record: 'materia', pk: ['materia']})
var periodos = defineEntity(context, {name: 'periodos', record: 'periodo', pk: ['periodo']})
var cursos = defineEntity(context, {
    name: 'cursos',
    record: 'curso',
    pk: ['periodo', 'materia'],
    fks: {
        periodos: {entity: 'periodos', fields: periodos.pk},
        materias: {entity: 'materias', fields: materias.pk},
    },
})
var docentes = defineEntity(context, {
    name: 'docentes',
    record: 'docente',
    pk: ['docente'],
    fks: {jefe: {entity: 'docentes', fields: {jefe: 'docente'}}},
})
var mesas = defineEntity(context, {
    name: 'mesas',
    record: 'mesa',
    pk: ['mesa'],
    fks: {
        presidente: {entity: 'docentes', fields: {presidente: 'docente'}},
        vocal     : {entity: 'docentes', fields: {vocal: 'docente'}},
    },
})
var personas = defineEntity(context, {name: 'personas', record: 'persona', pk: ['persona']})
var citas = defineEntity(context, {
    name: 'citas',
    record: 'cita',
    pk: ['cita'],
    fks: {persona: {entity: 'personas', fields: {persona: 'persona'}}},
})
var entityDefs = defineEntities({materias, periodos, cursos, docentes, mesas, personas, citas});
var entityInfos = completeEntities(context, entityDefs);

describe("createCrudQueries: referred isName joins", function(){
    it("without entityInfos, select stays exactly as before (no joins)", function(){
        var queries = createCrudQueries(context, entityInfos.cursos);
        assert.deepStrictEqual(queries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'}), {
            text: 'SELECT * FROM "cursos" WHERE "periodo" = $1 AND "materia" = $2;',
            values: ['2026-1c', 'AlgoI'],
        });
    })
    it("joins only the fks whose target has an isName field, aliasing by fk name", function(){
        var queries = createCrudQueries(context, entityInfos.cursos, entityInfos);
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
        var queries = createCrudQueries(context, entityInfos.cursos, entityInfos);
        var query = queries.selectWhere({materia: 'AlgoI'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "cursos".*, "materias"."denominacion" AS "materias__denominacion"'
                + ' FROM "cursos" LEFT JOIN "materias" AS "materias" ON "materias"."materia" = "cursos"."materia"'
                + ' WHERE "cursos"."materia" = $1;',
            values: ['AlgoI'],
        });
    })
    it("lets selectWhere filter by a joined isName column, routed to the joined table", function(){
        var queries = createCrudQueries(context, entityInfos.cursos, entityInfos);
        var query = queries.selectWhere({materias__denominacion: 'Algoritmos I'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "cursos".*, "materias"."denominacion" AS "materias__denominacion"'
                + ' FROM "cursos" LEFT JOIN "materias" AS "materias" ON "materias"."materia" = "cursos"."materia"'
                + ' WHERE "materias"."denominacion" = $1;',
            values: ['Algoritmos I'],
        });
    })
    it("combines a base field and a joined isName filter in one WHERE, numbering placeholders in order", function(){
        var queries = createCrudQueries(context, entityInfos.cursos, entityInfos);
        var query = queries.selectWhere({periodo: '2026-1c', materias__denominacion: 'Algoritmos I'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "cursos".*, "materias"."denominacion" AS "materias__denominacion"'
                + ' FROM "cursos" LEFT JOIN "materias" AS "materias" ON "materias"."materia" = "cursos"."materia"'
                + ' WHERE "cursos"."periodo" = $1 AND "materias"."denominacion" = $2;',
            values: ['2026-1c', 'Algoritmos I'],
        });
    })
    it("renders a null joined-column filter as IS NULL too", function(){
        var queries = createCrudQueries(context, entityInfos.cursos, entityInfos);
        var query = queries.selectWhere({materias__denominacion: null});
        assert.deepStrictEqual(query, {
            text: 'SELECT "cursos".*, "materias"."denominacion" AS "materias__denominacion"'
                + ' FROM "cursos" LEFT JOIN "materias" AS "materias" ON "materias"."materia" = "cursos"."materia"'
                + ' WHERE "materias"."denominacion" IS NULL;',
            values: [],
        });
    })
    it("filters by every isName field of a target with more than one, using each's own alias", function(){
        var queries = createCrudQueries(context, entityInfos.citas, entityInfos);
        var query = queries.selectWhere({persona__apellido: 'Perez', persona__nombres: 'Juan'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "citas".*, "persona"."apellido" AS "persona__apellido", "persona"."nombres" AS "persona__nombres"'
                + ' FROM "citas" LEFT JOIN "personas" AS "persona" ON "persona"."persona" = "citas"."persona"'
                + ' WHERE "persona"."apellido" = $1 AND "persona"."nombres" = $2;',
            values: ['Perez', 'Juan'],
        });
    })
    it("without entityInfos, a joined-alias-shaped filter key is just treated as a base column name", function(){
        var queries = createCrudQueries(context, entityInfos.cursos);
        var query = queries.selectWhere({materias__denominacion: 'Algoritmos I'});
        assert.deepStrictEqual(query, {
            text: 'SELECT * FROM "cursos" WHERE "materias__denominacion" = $1;',
            values: ['Algoritmos I'],
        });
    })
    it("gives two fks to the same target entity distinct join aliases and column aliases", function(){
        var queries = createCrudQueries(context, entityInfos.mesas, entityInfos);
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
        var queries = createCrudQueries(context, entityInfos.docentes, entityInfos);
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
        var queries = createCrudQueries(context, entityInfos.cursos, partialEntityInfos);
        // only the materias fk can be resolved; the periodos fk's target is missing, so it's skipped too (it has no isName anyway)
        var query = queries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'});
        assert.match(query.text, /"materias__denominacion"/);
    })
    it("accepts a custom separator for the joined column alias", function(){
        var queries = createCrudQueries(context, entityInfos.cursos, entityInfos, '.');
        var query = queries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'});
        assert.match(query.text, /"materias"."denominacion" AS "materias\.denominacion"/);
    })
    it("brings every isName field of the target, not just the first", function(){
        var queries = createCrudQueries(context, entityInfos.citas, entityInfos);
        var query = queries.selectByPk({cita: 'C1'});
        assert.deepStrictEqual(query, {
            text: 'SELECT "citas".*, "persona"."apellido" AS "persona__apellido", "persona"."nombres" AS "persona__nombres"'
                + ' FROM "citas" LEFT JOIN "personas" AS "persona" ON "persona"."persona" = "citas"."persona"'
                + ' WHERE "citas"."cita" = $1;',
            values: ['C1'],
        });
    })
    it("insert/update/delete stay exactly as before when entityInfos resolves no join for this entity", function(){
        // periodos has no fks at all, so there's nothing to join even though entityInfos is given
        var queries = createCrudQueries(context, entityInfos.periodos, entityInfos);
        assert.deepStrictEqual(queries.insert({periodo: '2026-1c'}), {
            text: 'INSERT INTO "periodos" ("periodo") VALUES ($1) RETURNING *;',
            values: ['2026-1c'],
        });
        assert.deepStrictEqual(queries.deleteByPk({periodo: '2026-1c'}), {
            text: 'DELETE FROM "periodos" WHERE "periodo" = $1 RETURNING *;',
            values: ['2026-1c'],
        });
    })
    it("insert falls back to RETURNING just the pk when a join would otherwise be needed", function(){
        var queries = createCrudQueries(context, entityInfos.cursos, entityInfos);
        var query = queries.insert({periodo: '2026-1c', materia: 'AlgoI'});
        assert.deepStrictEqual(query, {
            text: 'INSERT INTO "cursos" ("periodo", "materia") VALUES ($1, $2) RETURNING "periodo", "materia";',
            values: ['2026-1c', 'AlgoI'],
        });
        // re-fetching with selectByPk on that pk is what brings the joined names
        var followUp = queries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'});
        assert.match(followUp.text, /"materias__denominacion"/);
    })
    it("updateByPk falls back to RETURNING just the (possibly composite) pk too", function(){
        var queries = createCrudQueries(context, entityInfos.mesas, entityInfos);
        var query = queries.updateByPk({mesa: 'M1'}, {presidente: 'D2'});
        assert.deepStrictEqual(query, {
            text: 'UPDATE "mesas" SET "presidente" = $1 WHERE "mesa" = $2 RETURNING "mesa";',
            values: ['D2', 'M1'],
        });
    })
    it("deleteByPk falls back to RETURNING just the pk too", function(){
        var queries = createCrudQueries(context, entityInfos.mesas, entityInfos);
        var query = queries.deleteByPk({mesa: 'M1'});
        assert.deepStrictEqual(query, {
            text: 'DELETE FROM "mesas" WHERE "mesa" = $1 RETURNING "mesa";',
            values: ['M1'],
        });
    })
})
