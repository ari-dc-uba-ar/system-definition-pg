/* a parameterized query, ready for any driver that accepts (text, values) — pg, postgres.js,
   etc. Values are never interpolated into text: every dynamic value becomes a $n placeholder. */
export type SqlQuery = {
    text: string
    values: unknown[]
}
