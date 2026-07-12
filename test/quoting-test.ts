import * as assert from "assert";

import { quoteIdent, quoteLiteral } from "../src/quoting";

describe("sql quoting", function(){
    it("quotes identifiers with double quotes", function(){
        assert.equal(quoteIdent("docentes"), '"docentes"');
    })
    it("escapes embedded double quotes in identifiers by doubling them", function(){
        assert.equal(quoteIdent('a"b'), '"a""b"');
    })
    it("quotes non-ASCII identifiers the same way", function(){
        assert.equal(quoteIdent("año"), '"año"');
    })
    it("quotes string literals with single quotes", function(){
        assert.equal(quoteLiteral("hola"), "'hola'");
    })
    it("escapes embedded single quotes in literals by doubling them", function(){
        assert.equal(quoteLiteral("it's"), "'it''s'");
    })
})
