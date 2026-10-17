import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/futbol_sse" });
try {
  await pool.query("CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of ["0000_initial.sql", "0001_event_details.sql"]) {
    const { rows } = await pool.query("SELECT name FROM app_migrations WHERE name = $1", [name]);
    if (rows.length) { console.log(`Ya aplicada: ${name}`); continue; }
    const sql = await readFile(path.resolve("drizzle", name), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO app_migrations(name) VALUES($1)", [name]);
      await pool.query("COMMIT");
      console.log(`Migración aplicada: ${name}`);
    } catch (error) { await pool.query("ROLLBACK"); throw error; }
  }
} finally { await pool.end(); }
