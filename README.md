# system-definition-pg

Generates a PostgreSQL database-creation script (`.psql`) from a system described with
[system-definition](https://github.com/ari-dc-uba-ar/system-definition).

`system-definition` only covers the descriptive side of a system (domain types, fields,
records, entities, primary/foreign/unique keys) — it doesn't generate anything itself. This
module is one generator built on top of it: given a system's `entityDefs` and a mapping from
its domain types to PostgreSQL types, it produces the `CREATE TABLE`, `ALTER TABLE ... ADD
CONSTRAINT` (foreign keys) and `COMMENT ON COLUMN` statements needed to create the database.


## Usage

```ts
import { generateDatabaseScript, PgTypeMap } from "system-definition-pg";
import { entityDefs, typeDefs } from "./my-system";

const pgTypeMap: PgTypeMap<typeof typeDefs> = {
    text: 'text',
    integer: 'integer',
    boolean: 'boolean',
    // ...one PostgreSQL type per domain type declared in typeDefs
};

const script = generateDatabaseScript(entityDefs, pgTypeMap);
// write `script` to a .psql file, or feed it to `psql -f`
```

`generateDatabaseScript` is composed of smaller, independently usable pieces:

* `generateCreateTableStatement(tableName, entityInfo, pgTypeMap)` — columns (with `NOT
  NULL` where the field isn't nullable), the `PRIMARY KEY` and any `uks` as named `UNIQUE`
  constraints.
* `generateForeignKeyStatements(tableName, entityInfo)` — one `ALTER TABLE ... ADD
  CONSTRAINT ... FOREIGN KEY` per `fk`. Foreign keys are always emitted as `ALTER TABLE`
  statements *after* every table has been created, so table creation order never matters —
  this also covers reflexive fks (an entity referencing itself, e.g. an employee's manager)
  and forward references without any topological sort.
* `generateCommentStatements(tableName, entityInfo)` — a `COMMENT ON COLUMN` for every field
  that has a non-empty `description`.

Every identifier (table and column name) is double-quoted unconditionally, so reserved
words, mixed case and non-ASCII letters (e.g. `año`, `día`) all work without special-casing.


## Design decisions

* **Domain type → PostgreSQL type mapping is not part of system-definition.** A
  `TypeCollection` only carries the TypeScript side of a domain type (`tsType`); the SQL
  side is a separate concern decided by whoever generates the database, hence the standalone
  `PgTypeMap<TypeDefs>` type (`Record<keyof TypeDefs, string>`) that this module expects as
  input alongside `entityDefs`.
* **Foreign keys are always `ALTER TABLE`, never inline.** This keeps `CREATE TABLE`
  statement order irrelevant and makes reflexive and circular references trivial to support.
* **`label` is not rendered.** It's meant for UI generators; only `description` becomes a
  `COMMENT ON COLUMN`, since that's the PostgreSQL-native place for column documentation.
* **Constraint names are `<kind>_<table>_<key>`** (e.g. `fk_cursos_materias`,
  `uk_materias_denominacion`), derived from the table name and the `fk`/`uk` key in the
  entity definition, so two fks to the same target entity (e.g. `mesas.presidente` and
  `mesas.vocal`, both → `docentes`) get distinct constraint names.


## Structure

* `src/`: the generator — `quoting.ts` (identifier/literal escaping), `pg-type-map.ts` (the
  `PgTypeMap` type), `generate-schema.ts` (the statement generators), `index.ts` (public
  exports).
* `examples/aida/`: uses the `aida` example system shipped with `system-definition` to
  generate `examples/aida/aida-baseline.psql`, a full, real-world-shaped baseline script.
  Run `npm run generate-baseline` to regenerate it.
* `test/`: mocha tests for each generator piece, plus a snapshot test that regenerates the
  aida script and diffs it against the committed baseline.


## Development

```
npm install
npm test              # tsc + mocha over dist/test
npm run generate-baseline   # regenerate examples/aida/aida-baseline.psql
```

`npm test` compiles with TypeScript and runs mocha over the compiled output (no ts-node, no
loaders), mirroring `system-definition`'s own setup.


## Status

Design stage.


## License

MIT
