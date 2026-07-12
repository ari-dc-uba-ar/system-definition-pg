/* every identifier is quoted, unconditionally: it sidesteps reserved words, mixed case
   and non-ASCII letters (á, ñ...) without having to special-case any of them */
export function quoteIdent(name: string): string {
    return '"' + name.replace(/"/g, '""') + '"';
}

export function quoteLiteral(value: string): string {
    return "'" + value.replace(/'/g, "''") + "'";
}
