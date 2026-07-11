import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

import { generateAidaScript, baselinePath } from "../examples/aida/generate-baseline";

describe("aida baseline", function(){
    it("regenerates exactly the committed examples/aida/aida-baseline.psql", function(){
        var generated = generateAidaScript();
        var localPath = path.join(path.dirname(baselinePath), 'local-aida-baseline.psql');
        fs.writeFileSync(localPath, generated);
        var expected = fs.readFileSync(baselinePath, 'utf8').replace(/\r\n/g, '\n');
        assert.equal(generated, expected);
    })
})
