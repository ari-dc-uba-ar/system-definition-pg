import * as fs from "fs";
import * as path from "path";
import { aida, entityDefs } from "system-definition/examples";

import { generateDatabaseScript } from "../../src/generate-schema";
import { aidaPgTypeMap } from "./pg-type-map";

export function generateAidaScript(): string {
    return generateDatabaseScript(aida, entityDefs, aidaPgTypeMap);
}

export var baselinePath = path.join(__dirname, '..', '..', '..', 'examples', 'aida', 'aida-baseline.psql');

if (require.main === module) {
    fs.writeFileSync(baselinePath, generateAidaScript());
    console.log('wrote ' + baselinePath);
}
