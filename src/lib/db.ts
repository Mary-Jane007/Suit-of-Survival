import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;
let local: Promise<PGlite> | undefined;
let queue: Promise<unknown> = Promise.resolve();

export type Sql = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return enqueue(() => query<T>(text, params));
}

async function query<T>(text: string, params: unknown[]): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await pool.query(text, params)).rows as T[];
  }
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return (await (await local).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  const dir = process.env.SOS_DATA_DIR || path.join(process.cwd(), ".data", "pglite");
  const db = new PGlite(dir);
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const files = (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
  );
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(path.join("migrations", file), "utf8");
    await db.exec(body);
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
  return db;
}

export async function withTx<T>(fn: (q: Sql) => Promise<T>): Promise<T> {
  return enqueue(async () => {
    if (databaseUrl !== "") {
      pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
      const client = await pool.connect();
      const q: Sql = async (text, params = []) =>
        (await client.query(text, params)).rows as never;
      try {
        await client.query("begin");
        const result = await fn(q);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    }
    local ??= startLocal().catch((error: unknown) => {
      local = undefined;
      throw error;
    });
    const db = await local;
    return db.transaction(async (tx) => {
      const q: Sql = async (text, params = []) => (await tx.query(text, params)).rows as never;
      return fn(q);
    });
  });
}
