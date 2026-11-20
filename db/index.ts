import postgres from "postgres";

// Compatibility adapter for the application's existing D1-style queries.
// All values are passed as parameters; SQL is never interpolated with user input.
const url = process.env.DATABASE_URL;
const client = postgres(url || "postgres://invalid:invalid@localhost:5432/invalid", {
  max: 5,
  prepare: false,
  connect_timeout: 10,
});

type Params = unknown[];

export class PgStatement {
  constructor(readonly query: string, readonly params: Params = []) {}
  bind(...params: Params) { return new PgStatement(this.query, params); }
  compile() {
    let index = 0;
    let query = this.query.replace(/\?/g, () => `$${++index}`);
    const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(query);
    if (ignore) query = query.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO");
    // Translate the one-time workbook import's SQLite JSON snapshot guard.
    query = query.replace(/json_each\((\$\d+)\)/gi, (_, param) => `jsonb_array_elements((${param})::jsonb)`)
      .replace(/json_extract\(expected\.value\s*,\s*'\$\.([a-z_]+)'\)/gi, (_, field) =>
        field === "revision" ? `(expected.value->>'revision')::integer` : `(expected.value->>'${field}')`);
    if (ignore) query += " ON CONFLICT DO NOTHING";
    return query;
  }
  async all<T>() {
    const rows = await client.unsafe(this.compile(), this.params as never[]);
    return {results: rows as unknown as T[]};
  }
  async first<T>() { const {results} = await this.all<T>(); return results[0] ?? null; }
  async run() {
    const rows = await client.unsafe(this.compile(), this.params as never[]);
    return {meta: {changes: rows.count ?? 0}};
  }
}

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  return {
    prepare: (query: string) => new PgStatement(query),
    batch: (statements: PgStatement[]) => client.begin(async tx => {
      const results: {meta: {changes: number}}[] = [];
      for (const statement of statements) {
        const rows = await tx.unsafe(statement.compile(), statement.params as never[]);
        results.push({meta: {changes: rows.count ?? 0}});
      }
      return results;
    }),
  };
}
export type Database = ReturnType<typeof getDb>;
