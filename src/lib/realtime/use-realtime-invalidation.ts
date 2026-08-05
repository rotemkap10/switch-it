"use client";

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

export type PostgresChangeFilter = {
  event: "*" | "INSERT" | "UPDATE" | "DELETE";
  schema?: string;
  table: string;
  filter?: string;
};

export type UseRealtimeInvalidationOptions = {
  /** Deterministic channel name (must be unique per subscription identity). */
  channelName: string;
  /** One or more postgres_changes configs on the same channel. */
  changes: PostgresChangeFilter[];
  /** Called for each relevant event (already filtered by Supabase). */
  onEvent: (
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  ) => void;
  /** When false, no subscription is created. */
  enabled?: boolean;
};

/**
 * Route-scoped Realtime subscription with Strict Mode–safe cleanup.
 * Treat payloads as invalidation signals only.
 */
export function useRealtimeInvalidation({
  channelName,
  changes,
  onEvent,
  enabled = true,
}: UseRealtimeInvalidationOptions): void {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Stabilize filter identity for the effect dependency.
  const changesKey = JSON.stringify(changes);

  useEffect(() => {
    if (!enabled || changes.length === 0) {
      return;
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let client: SupabaseClient | null = null;

    client = createClient();
    let builder = client.channel(channelName);

    for (const change of changes) {
      builder = builder.on(
        "postgres_changes",
        {
          event: change.event,
          schema: change.schema ?? "public",
          table: change.table,
          filter: change.filter,
        },
        (payload) => {
          if (cancelled) {
            return;
          }
          onEventRef.current(
            payload as RealtimePostgresChangesPayload<Record<string, unknown>>,
          );
        },
      );
    }

    channel = builder.subscribe();

    return () => {
      cancelled = true;
      if (channel && client) {
        void client.removeChannel(channel);
      }
    };
    // changesKey captures filter identity; `changes` itself is intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- changesKey is the stable identity
  }, [channelName, changesKey, enabled]);
}
