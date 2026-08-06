import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260806150000_phase9b_claim_location_broadcast.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("phase9b claim location broadcast migration", () => {
  it("adds a safe topic parser with empty search_path", () => {
    expect(migrationSql).toContain(
      "create or replace function public.claim_location_topic_claim_id(p_topic text)",
    );
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain("claim-location:");
    expect(migrationSql).toContain("length(p_topic) <> 51");
    expect(migrationSql).toContain("invalid_text_representation");
  });

  it("uses SECURITY DEFINER boolean helpers so seeker INSERT is not blocked by parking_spots RLS", () => {
    expect(migrationSql).toContain(
      "create or replace function public.can_receive_claim_location(p_topic text)",
    );
    expect(migrationSql).toContain(
      "create or replace function public.can_send_claim_location(p_topic text)",
    );
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("returns boolean");
    expect(migrationSql).toContain("spots.owner_id = v_uid");
    expect(migrationSql).toContain("claims.seeker_id = v_uid");
    expect(migrationSql).toContain("claims.status = 'active'");
    expect(migrationSql).toContain("spots.status = 'claimed'");
    expect(migrationSql).toContain("spots.expires_at > pg_catalog.now()");
  });

  it("creates separate SELECT publisher and INSERT seeker policies", () => {
    expect(migrationSql).toContain('create policy "claim_location_publisher_select"');
    expect(migrationSql).toContain('create policy "claim_location_seeker_insert"');
    expect(migrationSql).toContain("for select");
    expect(migrationSql).toContain("for insert");
    expect(migrationSql).toContain("realtime.messages.extension = 'broadcast'");
    expect(migrationSql).toContain(
      "public.can_receive_claim_location((select realtime.topic()))",
    );
    expect(migrationSql).toContain(
      "public.can_send_claim_location((select realtime.topic()))",
    );
    expect(migrationSql).toContain("to authenticated");
  });

  it("does not weaken core RLS or Phase 9A functions", () => {
    expect(migrationSql).not.toContain("alter table public.parking_spots");
    expect(migrationSql).not.toContain("alter table public.claims");
    expect(migrationSql).not.toContain("alter table public.profiles");
    expect(migrationSql).not.toContain("create or replace function public.claim_spot");
    expect(migrationSql).not.toContain("create or replace function public.complete_claim");
    expect(migrationSql).not.toContain("using ( true )");
    expect(migrationSql).not.toContain("with check ( true )");
    expect(migrationSql).not.toContain("alter publication");
    expect(migrationSql).not.toMatch(/add table public\.(parking_spots|claims|profiles)/);
  });

  it("revokes anon and grants authenticated execute on helpers only", () => {
    for (const name of [
      "claim_location_topic_claim_id",
      "can_receive_claim_location",
      "can_send_claim_location",
    ]) {
      expect(migrationSql).toContain(
        `revoke all on function public.${name}(text) from anon`,
      );
      expect(migrationSql).toContain(
        `grant execute on function public.${name}(text) to authenticated`,
      );
    }
  });
});
