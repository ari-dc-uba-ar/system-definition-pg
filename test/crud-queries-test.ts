import * as assert from "assert";
import { commonTypeDefs, completeEntity, defineEntity } from "system-definition";

import { createCrudQueries } from "../src/crud-queries";

var materias = defineEntity({
    pk: ['materia'],
    fields: {
        materia     : {type: 'text'},
        denominacion: {type: 'text'},
        creditos    : {type: 'integer'},
    },
})
var materiasQueries = createCrudQueries('materias', completeEntity(materias));

var cursos = defineEntity({
    pk: ['periodo', 'materia'],
    fields: {
        periodo : {type: 'text'},
        materia : {type: 'text'},
        docente : {type: 'text'},
    },
})
var cursosQueries = createCrudQueries('cursos', completeEntity(cursos));

describe("createCrudQueries: selectByPk", function(){
    it("builds a WHERE with a single placeholder for a simple pk", function(){
        var query = materiasQueries.selectByPk({materia: 'AlgoI'});
        assert.deepStrictEqual(query, {
            text: 'SELECT * FROM "materias" WHERE "materia" = $1;',
            values: ['AlgoI'],
        });
    })
    it("builds a WHERE with one placeholder per pk field, in pk order, for a composite pk", function(){
        var query = cursosQueries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'});
        assert.deepStrictEqual(query, {
            text: 'SELECT * FROM "cursos" WHERE "periodo" = $1 AND "materia" = $2;',
            values: ['2026-1c', 'AlgoI'],
        });
    })
})

describe("createCrudQueries: selectWhere", function(){
    it("selects everything, without a WHERE, when no filter is given", function(){
        assert.deepStrictEqual(materiasQueries.selectWhere(), {
            text: 'SELECT * FROM "materias";',
            values: [],
        });
    })
    it("filters by equality on the given fields only", function(){
        var query = materiasQueries.selectWhere({creditos: 6});
        assert.deepStrictEqual(query, {
            text: 'SELECT * FROM "materias" WHERE "creditos" = $1;',
            values: [6],
        });
    })
    it("renders a null filter value as IS NULL, without consuming a placeholder", function(){
        var query = materiasQueries.selectWhere({denominacion: null as unknown as string, creditos: 6});
        assert.deepStrictEqual(query, {
            text: 'SELECT * FROM "materias" WHERE "denominacion" IS NULL AND "creditos" = $1;',
            values: [6],
        });
    })
})

describe("createCrudQueries: insert", function(){
    it("inserts every provided field and returns the inserted row", function(){
        var query = materiasQueries.insert({materia: 'AlgoI', denominacion: 'Algoritmos I', creditos: 6});
        assert.deepStrictEqual(query, {
            text: 'INSERT INTO "materias" ("materia", "denominacion", "creditos") VALUES ($1, $2, $3) RETURNING *;',
            values: ['AlgoI', 'Algoritmos I', 6],
        });
    })
    it("omits fields left undefined, so a column DEFAULT can apply", function(){
        var query = materiasQueries.insert({materia: 'AlgoI', denominacion: undefined, creditos: 6});
        assert.deepStrictEqual(query, {
            text: 'INSERT INTO "materias" ("materia", "creditos") VALUES ($1, $2) RETURNING *;',
            values: ['AlgoI', 6],
        });
    })
    it("rejects an insert with no fields at all", function(){
        assert.throws(() => materiasQueries.insert({}), /no fields provided for "materias"/);
    })
})

describe("createCrudQueries: updateByPk", function(){
    it("sets only the given fields and filters by the pk, numbering placeholders across both", function(){
        var query = materiasQueries.updateByPk({materia: 'AlgoI'}, {creditos: 8});
        assert.deepStrictEqual(query, {
            text: 'UPDATE "materias" SET "creditos" = $1 WHERE "materia" = $2 RETURNING *;',
            values: [8, 'AlgoI'],
        });
    })
    it("keeps placeholder numbering consistent with a composite pk and several changes", function(){
        var query = cursosQueries.updateByPk({periodo: '2026-1c', materia: 'AlgoI'}, {docente: 'D2'});
        assert.deepStrictEqual(query, {
            text: 'UPDATE "cursos" SET "docente" = $1 WHERE "periodo" = $2 AND "materia" = $3 RETURNING *;',
            values: ['D2', '2026-1c', 'AlgoI'],
        });
    })
    it("rejects an update with no fields to change", function(){
        assert.throws(() => materiasQueries.updateByPk({materia: 'AlgoI'}, {}), /no fields to update for "materias"/);
    })
})

describe("createCrudQueries: deleteByPk", function(){
    it("deletes by a simple pk and returns the deleted row", function(){
        assert.deepStrictEqual(materiasQueries.deleteByPk({materia: 'AlgoI'}), {
            text: 'DELETE FROM "materias" WHERE "materia" = $1 RETURNING *;',
            values: ['AlgoI'],
        });
    })
    it("deletes by a composite pk", function(){
        var query = cursosQueries.deleteByPk({periodo: '2026-1c', materia: 'AlgoI'});
        assert.deepStrictEqual(query, {
            text: 'DELETE FROM "cursos" WHERE "periodo" = $1 AND "materia" = $2 RETURNING *;',
            values: ['2026-1c', 'AlgoI'],
        });
    })
})
