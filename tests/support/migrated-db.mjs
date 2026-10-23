// Isolated Postgres for database tests: PGlite (in-process WebAssembly Postgres) with every
// migration in supabase/migrations applied in order. Nothing connects to Supabase.
//
// Supabase pieces the migrations expect are stubbed minimally: the anon / authenticated /
// service_role roles, auth.users + auth.uid() (read from the request.jwt.claim.sub setting,
// like PostgREST), and the storage tables. pgvector is not bundled with PGlite, so the unused
// embedding column becomes real[] and its HNSW index is skipped; nothing tested uses it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = fileURLToPath(new URL('../../', import.meta.url))
const migrationsDir = path.join(root, 'supabase/migrations')

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, encrypted_password text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
`

function withoutPgvector(sql) {
  return sql
    .replace(/create extension if not exists vector with schema extensions;/gi, '')
    .replace(/create index \w+\s+on public\.document_chunks\s+using hnsw \(embedding extensions\.vector_cosine_ops\);/gi, '')
    .replace(/extensions\.vector\(\d+\)/gi, 'real[]')
    .replace(/extensions\.vector\b(?!_)/gi, 'real[]')
}

/** Migration file names in apply order, optionally stopping before `until` (exclusive). */
export function migrationFiles({ until } = {}) {
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  return until ? files.filter((f) => f < until) : files
}

/** A fresh database with the migrations applied. `until`: stop before this migration (to test it on its own). */
export async function migratedDb({ until } = {}) {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  // Function bodies that reference pgvector operators are never called in tests.
  await db.exec('set check_function_bodies = off;')
  for (const file of migrationFiles({ until })) {
    try {
      await db.exec(withoutPgvector(fs.readFileSync(path.join(migrationsDir, file), 'utf8')))
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${error.message}`)
    }
  }
  await db.exec('set check_function_bodies = on;')
  return db
}

export async function applyMigration(db, file) {
  await db.exec(withoutPgvector(fs.readFileSync(path.join(migrationsDir, file), 'utf8')))
}

/** Runs `fn` as a Supabase API role (anon / authenticated), optionally as a signed-in user, then switches back. */
export async function asRole(db, role, fn, { userId = null } = {}) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
