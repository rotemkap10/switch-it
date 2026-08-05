import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260805120000_handoff_verification_code.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("handoff verification code migration", () => {
  it("creates the private secret table with RLS and no client grants", () => {
    expect(migrationSql).toContain("create table public.claim_handoff_secrets");
    expect(migrationSql).toContain("claim_id uuid primary key");
    expect(migrationSql).toContain("code_hash text not null");
    expect(migrationSql).toContain("code_plain text not null");
    expect(migrationSql).toContain("attempt_count integer not null default 0");
    expect(migrationSql).toContain(
      "alter table public.claim_handoff_secrets enable row level security",
    );
    expect(migrationSql).toContain(
      "revoke all on table public.claim_handoff_secrets from authenticated",
    );
  });

  it("uses pgcrypto for secure generation and bcrypt hashing", () => {
    expect(migrationSql).toContain("create extension if not exists pgcrypto");
    expect(migrationSql).toContain("extensions.gen_random_bytes");
    expect(migrationSql).toContain("extensions.crypt");
    expect(migrationSql).toContain("extensions.gen_salt('bf', 8)");
  });

  it("backfills active claims without changing statuses", () => {
    const backfillSection =
      migrationSql.split("-- Backfill secrets for existing active claims")[1]?.split(
        "-- get_handoff_code",
      )[0] ?? "";

    expect(backfillSection).toContain("claims.status = 'active'");
    expect(backfillSection).toContain("spots.status = 'claimed'");
    expect(backfillSection).toContain("create_claim_handoff_secret");
    expect(backfillSection).not.toContain("update public.claims");
    expect(backfillSection).not.toContain("update public.profiles");
  });

  it("creates owner-only get_handoff_code and verified complete_claim", () => {
    expect(migrationSql).toContain(
      "create or replace function public.get_handoff_code(p_claim_id uuid)",
    );
    expect(migrationSql).toContain("drop function if exists public.complete_claim(uuid)");
    expect(migrationSql).toContain(
      "create or replace function public.complete_claim(",
    );
    expect(migrationSql).toContain("p_handoff_code text");
    expect(migrationSql).toContain("INVALID_HANDOFF_CODE");
    expect(migrationSql).toContain("HANDOFF_TEMPORARILY_LOCKED");
    expect(migrationSql).toContain("HANDOFF_UNAVAILABLE");
  });

  it("updates claim_spot to create one secret atomically", () => {
    expect(migrationSql).toContain(
      "perform public.create_claim_handoff_secret(v_claim_id)",
    );
  });

  it("revokes internal helper execution from clients", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.create_claim_handoff_secret(uuid) from authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.get_handoff_code(uuid) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.complete_claim(uuid, text) to authenticated",
    );
  });
});
