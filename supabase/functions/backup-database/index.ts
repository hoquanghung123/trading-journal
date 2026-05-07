import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") ?? "tradingjournal-chart";

// Tables in dependency order (parents before children to avoid FK violations)
const TABLES = [
  "profiles",
  "user_settings",
  "symbols",
  "journal_entries",
  "trades",
  "psychology_logs",
  "trading_reviews",
  "playbook_setups",
  "monthly_funding",
  "user_achievements",
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pool = new Pool(SUPABASE_DB_URL, 1, true);

  try {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `backup_${timestamp}.sql`;
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const r2Key = `backups/${year}/${month}/${filename}`;

    console.log(`Starting full backup (schema + data): ${r2Key}`);

    const db = await pool.connect();
    const sqlParts: string[] = [];

    // ── Header ────────────────────────────────────────────────────────────
    sqlParts.push(`-- =====================================================`);
    sqlParts.push(`-- ICT Trading Journal — Full Database Backup`);
    sqlParts.push(`-- Generated : ${now.toISOString()}`);
    sqlParts.push(`-- Includes  : Schema (DDL) + Data (DML)`);
    sqlParts.push(`-- Tables    : ${TABLES.join(", ")}`);
    sqlParts.push(`-- =====================================================`);
    sqlParts.push(``);

    // ── SECTION 1: SCHEMA (DDL) ───────────────────────────────────────────
    sqlParts.push(`-- =====================================================`);
    sqlParts.push(`-- SECTION 1: SCHEMA`);
    sqlParts.push(`-- =====================================================`);
    sqlParts.push(``);

    // 1a. Get columns for each table
    const columnsResult = await db.queryObject<{
      table_name: string;
      column_name: string;
      ordinal_position: number;
      column_default: string | null;
      is_nullable: string;
      data_type: string;
      udt_name: string;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
    }>(`
      SELECT
        c.table_name,
        c.column_name,
        c.ordinal_position,
        c.column_default,
        c.is_nullable,
        c.data_type,
        c.udt_name,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = ANY($1)
      ORDER BY c.table_name, c.ordinal_position
    `, [TABLES]);

    // 1b. Get primary keys
    const pkResult = await db.queryObject<{
      table_name: string;
      column_name: string;
    }>(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      ORDER BY tc.table_name, kcu.ordinal_position
    `, [TABLES]);

    // 1c. Get unique constraints (non-PK)
    const uniqueResult = await db.queryObject<{
      table_name: string;
      constraint_name: string;
      column_name: string;
    }>(`
      SELECT tc.table_name, tc.constraint_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      ORDER BY tc.table_name, tc.constraint_name
    `, [TABLES]);

    // 1d. Get indexes (excluding PK and unique indexes already defined in constraints)
    const indexResult = await db.queryObject<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1)
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `, [TABLES]);

    // 1e. Get RLS status
    const rlsResult = await db.queryObject<{
      tablename: string;
      rowsecurity: boolean;
    }>(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1)
    `, [TABLES]);

    // Build lookup maps
    const colsByTable = new Map<string, typeof columnsResult.rows>();
    const pksByTable = new Map<string, string[]>();
    const uniqueByTable = new Map<string, Map<string, string[]>>();
    const rlsByTable = new Map<string, boolean>();

    for (const row of columnsResult.rows) {
      if (!colsByTable.has(row.table_name)) colsByTable.set(row.table_name, []);
      colsByTable.get(row.table_name)!.push(row);
    }
    for (const row of pkResult.rows) {
      if (!pksByTable.has(row.table_name)) pksByTable.set(row.table_name, []);
      pksByTable.get(row.table_name)!.push(row.column_name);
    }
    for (const row of uniqueResult.rows) {
      if (!uniqueByTable.has(row.table_name)) uniqueByTable.set(row.table_name, new Map());
      const m = uniqueByTable.get(row.table_name)!;
      if (!m.has(row.constraint_name)) m.set(row.constraint_name, []);
      m.get(row.constraint_name)!.push(row.column_name);
    }
    for (const row of rlsResult.rows) {
      rlsByTable.set(row.tablename, row.rowsecurity);
    }

    // Generate CREATE TABLE for each table
    for (const table of TABLES) {
      const cols = colsByTable.get(table) ?? [];
      const pks = pksByTable.get(table) ?? [];
      const uniques = uniqueByTable.get(table) ?? new Map();
      const rlsEnabled = rlsByTable.get(table) ?? false;

      if (cols.length === 0) continue;

      sqlParts.push(`-- Table: ${table}`);
      sqlParts.push(`DROP TABLE IF EXISTS public."${table}" CASCADE;`);
      sqlParts.push(`CREATE TABLE public."${table}" (`);

      const colDefs: string[] = [];
      for (const col of cols) {
        const typeStr = mapPgType(col.data_type, col.udt_name, col.character_maximum_length);
        const nullable = col.is_nullable === "YES" ? "" : " NOT NULL";
        const def = col.column_default ? ` DEFAULT ${col.column_default}` : "";
        colDefs.push(`  "${col.column_name}" ${typeStr}${def}${nullable}`);
      }

      if (pks.length > 0) {
        colDefs.push(`  PRIMARY KEY (${pks.map((p) => `"${p}"`).join(", ")})`);
      }

      for (const [constraintName, cols2] of uniques.entries()) {
        colDefs.push(`  CONSTRAINT "${constraintName}" UNIQUE (${cols2.map((c) => `"${c}"`).join(", ")})`);
      }

      sqlParts.push(colDefs.join(",\n"));
      sqlParts.push(`);`);

      if (rlsEnabled) {
        sqlParts.push(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;`);
      }
      sqlParts.push(``);
    }

    // Generate CREATE INDEX statements
    const indexesByTable = new Map<string, typeof indexResult.rows>();
    for (const row of indexResult.rows) {
      if (!indexesByTable.has(row.tablename)) indexesByTable.set(row.tablename, []);
      indexesByTable.get(row.tablename)!.push(row);
    }

    let hasIndexes = false;
    for (const table of TABLES) {
      const idxs = indexesByTable.get(table) ?? [];
      if (idxs.length === 0) continue;
      if (!hasIndexes) {
        sqlParts.push(`-- Indexes`);
        hasIndexes = true;
      }
      for (const idx of idxs) {
        sqlParts.push(`${idx.indexdef};`);
      }
    }
    if (hasIndexes) sqlParts.push(``);

    db.release();

    // ── SECTION 2: DATA (DML) ─────────────────────────────────────────────
    sqlParts.push(`-- =====================================================`);
    sqlParts.push(`-- SECTION 2: DATA`);
    sqlParts.push(`-- =====================================================`);
    sqlParts.push(``);
    sqlParts.push(`BEGIN;`);
    sqlParts.push(``);

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        continue;
      }

      const rows = data ?? [];
      sqlParts.push(`-- ${table} (${rows.length} rows)`);

      if (rows.length === 0) {
        sqlParts.push(`-- (empty)`);
        sqlParts.push(``);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const colList = columns.map((c) => `"${c}"`).join(", ");
      const BATCH = 50;

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const valuesList = batch.map((row) => {
          const vals = columns.map((col) => formatSqlValue(row[col]));
          return `  (${vals.join(", ")})`;
        });
        sqlParts.push(
          `INSERT INTO public."${table}" (${colList}) VALUES\n${valuesList.join(",\n")}\nON CONFLICT DO NOTHING;`
        );
      }

      sqlParts.push(``);
    }

    sqlParts.push(`COMMIT;`);
    sqlParts.push(``);
    sqlParts.push(`-- =====================================================`);
    sqlParts.push(`-- Backup complete.`);
    sqlParts.push(`-- =====================================================`);

    const sqlContent = sqlParts.join("\n");
    const sqlBytes = new TextEncoder().encode(sqlContent);

    // ── Upload to R2 ───────────────────────────────────────────────────────
    let r2Uploaded = false;
    if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
      try {
        const aws = new AwsClient({
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
          region: "auto",
          service: "s3",
        });
        const uploadUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${r2Key}`;
        const uploadRes = await aws.fetch(uploadUrl, {
          method: "PUT",
          body: sqlBytes,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Length": String(sqlBytes.length),
          },
        });
        if (uploadRes.ok) {
          r2Uploaded = true;
          console.log(`Uploaded to R2: ${r2Key} (${(sqlBytes.length / 1024).toFixed(1)} KB)`);
        } else {
          console.error(`R2 upload failed: ${uploadRes.status} - ${await uploadRes.text()}`);
        }
      } catch (r2Err) {
        console.error("R2 upload error:", r2Err);
      }
    }

    return new Response(sqlBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
        "X-Backup-Filename": filename,
        "X-R2-Uploaded": String(r2Uploaded),
        "X-R2-Key": r2Uploaded ? r2Key : "",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Backup failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } finally {
    await pool.end();
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Maps information_schema data_type + udt_name to a Postgres type string.
 */
function mapPgType(
  dataType: string,
  udtName: string,
  charMaxLength: number | null
): string {
  switch (dataType) {
    case "uuid": return "UUID";
    case "text": return "TEXT";
    case "boolean": return "BOOLEAN";
    case "integer": return "INTEGER";
    case "bigint": return "BIGINT";
    case "smallint": return "SMALLINT";
    case "real": return "REAL";
    case "double precision": return "DOUBLE PRECISION";
    case "numeric": return "NUMERIC";
    case "date": return "DATE";
    case "time without time zone": return "TIME";
    case "time with time zone": return "TIMETZ";
    case "timestamp without time zone": return "TIMESTAMP";
    case "timestamp with time zone": return "TIMESTAMPTZ";
    case "jsonb": return "JSONB";
    case "json": return "JSON";
    case "bytea": return "BYTEA";
    case "character varying":
      return charMaxLength ? `VARCHAR(${charMaxLength})` : "VARCHAR";
    case "character":
      return charMaxLength ? `CHAR(${charMaxLength})` : "CHAR";
    case "ARRAY":
      // e.g. udt_name = "_text" → text[]
      return udtName.startsWith("_") ? `${udtName.slice(1)}[]` : `${udtName}[]`;
    case "USER-DEFINED":
      return udtName; // e.g. custom enum names
    default:
      return dataType.toUpperCase();
  }
}

/**
 * Formats a JS value as a safe SQL literal.
 */
function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}
