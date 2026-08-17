import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260817180000_handoff_push_notifications.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("handoff push notifications migration", () => {
  it("stores private device tokens with owner-only RLS", () => {
    expect(sql).toContain("create table public.push_devices");
    expect(sql).toContain("push_devices_select_own");
    expect(sql).toContain("user_id = (select auth.uid())");
    expect(sql).toContain("constraint push_devices_push_token_key unique (push_token)");
    expect(sql).toContain("constraint push_devices_user_install_key unique (user_id, device_install_id)");
    expect(sql).toContain("grant select, insert, update, delete on table public.push_devices to service_role");
    expect(sql).toContain("grant select, insert, update on table public.handoff_notification_events to service_role");
    expect(sql).not.toContain("using ( true )");
  });

  it("does not grant unrelated users outbox or token visibility", () => {
    expect(sql).toContain("revoke all on table public.handoff_notification_events from authenticated");
    expect(sql).toContain("revoke all on table public.handoff_notification_events from anon");
  });

  it("upserts tokens and disables the current install on logout RPC", () => {
    expect(sql).toContain("create or replace function public.upsert_push_device");
    expect(sql).toContain("create or replace function public.disable_push_device");
    expect(sql).toContain("grant execute on function public.upsert_push_device");
    expect(sql).toContain("grant execute on function public.disable_push_device");
    expect(sql).toContain("on conflict (user_id, device_install_id) do update");
    expect(sql).toContain("delete from public.push_devices as devices");
    expect(sql).toContain("devices.push_token = p_push_token");
  });

  it("maps real claim/spot transitions to the six handoff types", () => {
    expect(sql).toContain("'driver_claimed'");
    expect(sql).toContain("'spot_cancelled'");
    expect(sql).toContain("'seeker_cancelled'");
    expect(sql).toContain("'handoff_completed'");
    expect(sql).toContain("'handoff_expiring_soon'");
    expect(sql).toContain("'driver_nearby'");
    expect(sql).toContain("constraint handoff_notification_events_dedupe unique (dedupe_key)");
  });

  it("does not send seeker_cancelled when the publisher cancels the spot", () => {
    const spotFn = sql.slice(
      sql.indexOf("enqueue_push_on_spot_change"),
      sql.indexOf("parking_spots_enqueue_handoff_push"),
    );
    expect(spotFn).toContain("NEW.status = 'cancelled'");
    expect(spotFn).toContain("'spot_cancelled'");
    expect(spotFn).toContain("NEW.status = 'available'");
    expect(spotFn).toContain("'seeker_cancelled'");
  });

  it("dispatches asynchronously and schedules expiring-soon without blocking RPCs", () => {
    expect(sql).toContain("net.http_post");
    expect(sql).toContain("enqueue_handoff_expiring_soon");
    expect(sql).toContain("interval '60 seconds'");
  });
});
