import * as assert from "assert";
import {
    CoreFieldDef, EntityInfo, EntityInfoOf, boxType, commonTypeDefs, completeCoreField,
    completeEntity, defineEntities, defineEntity, defineRecord, defineTypes, withRecords,
} from "system-definition";
import { aida, cursos, entityDefs } from "system-definition/examples";

import { completeEntities } from "../src/entity-infos";
import { PgContext } from "../src/pg-context";
import { testTypes } from "./test-system";

/* asserting a relation between types with a helper and not with @ts-expect-error: the
   directive suppresses any error on its line, so it would also pass for the wrong reason */
type IsAssignable<A, B> = [A] extends [B] ? true : false

/* a system that only completes the core: no description, no isName */
var poorTypes = {text: {tsType: boxType<string>()}}
var poor = withRecords(defineTypes({
    types: poorTypes,
    completeField: (fieldDef: CoreFieldDef<typeof poorTypes>, name: string) => completeCoreField(fieldDef, name),
}), {})

describe("PgContext", function(){
    it("accepts a system whose field info carries description and isName", function(){
        var accepted: IsAssignable<typeof aida, PgContext<typeof aida>> = true
        var testContext = withRecords(testTypes, {});
        var alsoAccepted: IsAssignable<typeof testContext, PgContext<typeof testContext>> = true
        assert.ok(accepted && alsoAccepted);
    })
    it("rejects a system whose field info only carries the core", function(){
        var rejected: IsAssignable<typeof poor, PgContext<typeof poor>> = false
        assert.equal(rejected, false);
    })
})

describe("completeEntities", function(){
    it("keys the map by each entity's own name, which the Def now carries", function(){
        var infos = completeEntities(aida, entityDefs);
        assert.deepStrictEqual(Object.keys(infos), Object.keys(entityDefs));
        Object.entries(infos).forEach(([name, info]) => assert.equal(info.name, name));
    })
    it("the precise Info of a concrete system is assignable to the wide one generators consume", function(){
        var preciseFitsWide: IsAssignable<EntityInfoOf<typeof aida, typeof cursos>, EntityInfo<typeof aida>> = true
        var wide: EntityInfo<typeof aida> = completeEntity(aida, cursos);
        assert.ok(preciseFitsWide);
        assert.equal(wide.name, 'cursos');
    })
    it("completes the pk fields as not nullable, which is what puts NOT NULL on those columns", function(){
        var context = withRecords(testTypes, {
            curso: defineRecord(testTypes, {periodo: {type: 'text'}, materia: {type: 'text'}, docente: {type: 'text'}}),
        });
        var cursosEntity = defineEntity(context, {name: 'cursos', record: 'curso', pk: ['periodo', 'materia']});
        var infos = completeEntities(context, defineEntities({cursos: cursosEntity}));
        assert.equal(infos.cursos.fields.periodo.nullable, false);
        assert.equal(infos.cursos.fields.docente.nullable, true);
    })
})
