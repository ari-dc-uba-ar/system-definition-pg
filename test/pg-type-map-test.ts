import * as assert from "assert";
import { commonTypeDefs, defineEntity } from "system-definition";
import { typeDefs } from "system-definition/examples";

import { PgTypeMap, commonPgTypeMap } from "../src/pg-type-map";
import { generateCreateTableStatement } from "../src/generate-schema";
import { completeEntities } from "../src/entity-infos";
import { aidaPgTypeMap } from "../examples/aida/index";

describe("commonPgTypeMap", function(){
    it("covers every common type and nothing else", function(){
        assert.deepStrictEqual(commonPgTypeMap, {text: 'text', integer: 'integer', boolean: 'boolean'});
        assert.deepStrictEqual(Object.keys(commonPgTypeMap).sort(), Object.keys(commonTypeDefs).sort());
    })
    it("is a PgTypeMap of the common types, in both directions", function(){
        var asMap: PgTypeMap<typeof commonTypeDefs> = commonPgTypeMap;
        var backAgain: typeof commonPgTypeMap = asMap;
        assert.equal(backAgain.integer, 'integer');
        // @ts-expect-error a type outside the common collection is not in the map
        var noColumn = commonPgTypeMap.fecha;
        assert.equal(noColumn, undefined);
    })
    it("is spread by a system that adds its own types", function(){
        var withDate: PgTypeMap<typeof typeDefs> = {...commonPgTypeMap, fecha: 'date', email: 'text'};
        assert.deepStrictEqual(withDate, aidaPgTypeMap);
        // @ts-expect-error spreading it is not enough when the system declares more types
        var incomplete: PgTypeMap<typeof typeDefs> = {...commonPgTypeMap};
        assert.equal(incomplete.text, 'text');
    })
    it("writes the columns of an entity of only common types", function(){
        var cargos = defineEntity({
            pk: ['cargo'],
            fields: {
                cargo        : {type: 'text'},
                orden        : {type: 'integer'},
                puede_dirigir: {type: 'boolean'},
            },
        });
        var entityInfos = completeEntities({cargos});
        assert.equal(
            generateCreateTableStatement('cargos', entityInfos['cargos'], commonPgTypeMap),
            'CREATE TABLE "cargos" (\n'
            + '    "cargo" text,\n'
            + '    "orden" integer,\n'
            + '    "puede_dirigir" boolean,\n'
            + '    PRIMARY KEY ("cargo")\n'
            + ');'
        );
    })
})
