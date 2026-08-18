import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260818120000_plate_handoff_verification.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("plate handoff verification migration", () => {
  it("masks counterpart plates in SQL without returning the full plate or photo path", () => {
    expect(migrationSql).toContain(
      "drop function if exists public.get_handoff_counterpart_vehicle(uuid)",
    );
    expect(migrationSql).toContain("vehicle_license_plate_masked text");
    expect(migrationSql).toContain("public.mask_license_plate_for_handoff(profiles.license_plate)");
    expect(migrationSql).not.toContain("vehicle_license_plate text");
    expect(migrationSql).not.toContain("vehicle_photo_path");
    expect(migrationSql).not.toContain("profiles.vehicle_photo_path");
  });

  it("drops the old complete_claim signature before recreating p_plate_suffix", () => {
    expect(migrationSql).toContain("drop function public.complete_claim(uuid, text);");
    expect(migrationSql).not.toContain("drop function public.complete_claim(uuid, text) cascade");
    const created = migrationSql.slice(
      migrationSql.indexOf("create function public.complete_claim("),
    );
    expect(created).toContain("p_claim_id uuid");
    expect(created).toContain("p_plate_suffix text");
    expect(created).not.toContain("p_handoff_code");
    expect(migrationSql).toContain(
      "revoke all on function public.complete_claim(uuid, text) from public",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.complete_claim(uuid, text) from anon",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.complete_claim(uuid, text) to authenticated",
    );
    expect(migrationSql).not.toContain(
      "grant execute on function public.complete_claim(uuid, text) to anon",
    );
    expect(migrationSql).not.toContain(
      "grant execute on function public.complete_claim(uuid, text) to public",
    );
  });

  it("verifies the last two plate digits server-side with 3 attempts and a 2-minute lock", () => {
    expect(migrationSql).toContain("p_plate_suffix text");
    expect(migrationSql).toContain("v_max_attempts integer := 3");
    expect(migrationSql).toContain("interval '2 minutes'");
    expect(migrationSql).toContain("right(v_owner_digits, 2)");
    expect(migrationSql).toContain("INVALID_PLATE_DIGITS");
    expect(migrationSql).toContain("attempts_remaining=");
    expect(migrationSql).toContain("HANDOFF_TEMPORARILY_LOCKED");
    expect(migrationSql).toContain("claim_handoff_secrets");
    expect(migrationSql).toContain("for update");
  });

  it("never raises the expected suffix or owner plate in exception text", () => {
    expect(migrationSql).not.toMatch(
      /raise exception 'INVALID_PLATE_DIGITS'[\s\S]{0,200}v_expected_suffix/,
    );
    expect(migrationSql).not.toContain("|| v_expected_suffix");
    expect(migrationSql).not.toContain("|| v_owner_digits");
  });

  it("keeps the existing atomic credit transfer and dormant spoken-code RPC", () => {
    expect(migrationSql).toContain("'handoff_debit'");
    expect(migrationSql).toContain("'handoff_credit'");
    expect(migrationSql).toContain("already_completed");
    expect(migrationSql).toContain("create or replace function public.get_handoff_code");
    expect(migrationSql).toContain("Spoken handoff codes are no longer used");
    expect(migrationSql).toContain("return;");
  });

  it("does not grant plate helpers to clients", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.mask_license_plate_for_handoff(text) from authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.complete_claim(uuid, text) to authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.get_handoff_counterpart_vehicle(uuid) to authenticated",
    );
  });
});
