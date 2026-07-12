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


## CRUD queries

`createCrudQueries(tableName, entityInfo)` builds `select`/`insert`/`update`/`delete` query
generators for one entity, typed against its fields. Every generator returns a plain
`SqlQuery` (`{text, values}`) — nothing is interpolated into the SQL text, every dynamic
value is a `$n` placeholder — so the result can be handed to any driver that accepts
`(text, values)` (`pg`, `postgres.js`, ...), whether that's inside an HTTP endpoint handler
or anywhere else in the program:

```ts
import { createCrudQueries } from "system-definition-pg";
import { completeEntity } from "system-definition";
import { docentes } from "./my-system";

const docentesQueries = createCrudQueries('docentes', completeEntity(docentes));

app.get('/docentes/:id', async (req, res) => {
    const { text, values } = docentesQueries.selectByPk({docente: req.params.id});
    const { rows } = await pool.query(text, values);
    res.json(rows[0]);
});
```

* `selectByPk(pk)` — one row by its (possibly composite) primary key.
* `selectWhere(filter?)` — rows matching an equality filter on any subset of fields
  (`null` renders as `IS NULL`); no filter (or `{}`) selects everything.
* `insert(record)` — `INSERT ... RETURNING *`. Fields left `undefined` are omitted from the
  statement, so a column `DEFAULT` (e.g. a serial pk) can still apply.
* `updateByPk(pk, changes)` — `UPDATE ... RETURNING *`, setting only the fields present in
  `changes`; throws if `changes` has nothing to set.
* `deleteByPk(pk)` — `DELETE ... RETURNING *`.

### Bringing in referenced names

Pass the whole system's entities as a third argument and every generator — `selectByPk`,
`selectWhere`, and also `insert`/`updateByPk`/`deleteByPk`'s `RETURNING` — will `LEFT JOIN`
every fk whose target entity has field(s) marked `isName: true`, bringing each of them along
aliased as `"<fkName><separator><nameField>"` (separator defaults to `__`; a record can mark
more than one field `isName`, e.g. a person's `apellido` and `nombres`):

```ts
import { completeEntities, createCrudQueries } from "system-definition-pg";
import { entityDefs } from "./my-system"; // cursos.fks.materias -> materias, and materias.denominacion has isName: true

const entityInfos = completeEntities(entityDefs);
const cursosQueries = createCrudQueries('cursos', entityInfos.cursos, entityInfos);
// createCrudQueries(tableName, entityInfo, entityInfos?, separator = '__')

const { text, values } = cursosQueries.selectByPk({periodo: '2026-1c', materia: 'AlgoI'});
// SELECT "cursos".*, "materias"."denominacion" AS "materias__denominacion"
// FROM "cursos" LEFT JOIN "materias" AS "materias" ON "materias"."materia" = "cursos"."materia"
// WHERE "cursos"."periodo" = $1 AND "cursos"."materia" = $2;
```

The fk name (not the target table name) is used as the join alias, so two fks to the same
entity — `mesas.presidente` and `mesas.vocal`, both → `docentes` — get distinct joins and
column aliases (`presidente__nombre`, `vocal__nombre`); this also makes a reflexive fk (e.g.
`docentes.jefe` → `docentes`) an unambiguous self-join. A fk whose target has no `isName`
field (not every entity needs a human-readable name — `periodos` in the example above
doesn't) is simply not joined. `entityInfos` is optional; without it, every generator
behaves exactly as before, regardless of `separator`.

`RETURNING` can only see the mutated table's own columns, so a plain `RETURNING *` can't
join anything — when `insert`/`updateByPk`/`deleteByPk` do have a join to bring in, they
wrap the statement as a `WITH ... AS (... RETURNING *) SELECT ... FROM ... LEFT JOIN ...`
instead. It's still one round trip and one `SqlQuery`:

```ts
cursosQueries.updateByPk({periodo: '2026-1c', materia: 'AlgoI'}, {docente: 'D2'});
// WITH "_mutated_row" AS (
//   UPDATE "cursos" SET "docente" = $1 WHERE "periodo" = $2 AND "materia" = $3 RETURNING *
// ) SELECT "_mutated_row".*, "materias"."denominacion" AS "materias__denominacion"
// FROM "_mutated_row" LEFT JOIN "materias" AS "materias" ON "materias"."materia" = "_mutated_row"."materia";
```

This is a runtime-only convenience for now: `SqlQuery` still has no row type, so the joined
columns aren't reflected in `Instance`/the function types yet — typing that (a shape that
depends on which fks resolve to a name at the value level) is left for later.


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
* **CRUD queries are pure builders, not an executable driver.** `createCrudQueries` never
  imports a database driver and never opens a connection; it only returns `{text, values}`.
  That keeps it usable both directly in a program and behind an HTTP endpoint, and testable
  without a running database — this repo's own CRUD tests assert on the returned SQL and
  values only, no live Postgres involved.


## Structure

* `src/`: the generator — `quoting.ts` (identifier/literal escaping), `pg-type-map.ts` (the
  `PgTypeMap` type), `entity-infos.ts` (`completeEntities`, the `EntityInfoMap` type),
  `generate-schema.ts` (DDL statement generators), `sql-query.ts` (the `SqlQuery` type),
  `crud-queries.ts` (`createCrudQueries`), `index.ts` (public exports).
* `examples/aida/`: uses the `aida` example system shipped with `system-definition` to
  generate `examples/aida/aida-baseline.psql`, a full, real-world-shaped baseline script.
  Run `npm run generate-baseline` to regenerate it.
* `test/`: mocha tests for each generator piece (DDL and CRUD, including the referred-name
  joins), plus a snapshot test that regenerates the aida script and diffs it against the
  committed baseline.


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
