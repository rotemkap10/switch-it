"use client";

import { useState, useTransition } from "react";

import { loadMoreHistory } from "@/actions/history";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  formatHistoryWhen,
  groupHistoryItems,
  historyCreditLabel,
  historyRoleLabel,
  historyStatusLabel,
  HISTORY_ADDRESS_FALLBACK,
  type HistoryItem,
} from "@/lib/history/format";
import type { HistoryCursor } from "@/lib/history/load-history";

type HistoryListProps = {
  items: HistoryItem[];
  hasMore?: boolean;
  nextCursor?: HistoryCursor | null;
};

function mergeHistoryItems(
  existing: HistoryItem[],
  incoming: HistoryItem[],
): HistoryItem[] {
  const seen = new Set(existing.map((item) => item.id));
  const appended: HistoryItem[] = [];
  for (const item of incoming) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    appended.push(item);
  }
  return appended.length === 0 ? existing : [...existing, ...appended];
}

export function HistoryList({
  items: initialItems,
  hasMore: initialHasMore = false,
  nextCursor: initialCursor = null,
}: HistoryListProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [cursor, setCursor] = useState<HistoryCursor | null>(initialCursor);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onLoadMore() {
    if (!cursor || pending) {
      return;
    }

    startTransition(async () => {
      const result = await loadMoreHistory(cursor);
      if (!result.ok) {
        setLoadError(
          result.error ?? "Couldn’t load more handoffs. Please try again.",
        );
        return;
      }

      setLoadError(null);
      setItems((current) => mergeHistoryItems(current, result.items));
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    });
  }

  if (items.length === 0) {
    return (
      <div
        className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-8 text-center"
        data-testid="history-empty"
      >
        <p className="text-base font-semibold text-foreground">No activity yet</p>
        <p className="mt-1 text-sm text-muted">
          Parking handoffs you share or find will show up here.
        </p>
      </div>
    );
  }

  const groups = groupHistoryItems(items);

  return (
    <div className="flex flex-col gap-6" data-testid="history-list">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {group.label}
          </h2>
          <ul className="flex flex-col gap-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <HistoryCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {loadError ? (
        <Alert tone="error" title="Couldn’t load more">
          {loadError}
        </Alert>
      ) : null}

      {hasMore && cursor ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full min-h-[var(--app-tap-min)]"
          loading={pending}
          disabled={pending}
          onClick={onLoadMore}
          data-testid="history-load-more"
        >
          {pending ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const address = item.address?.trim() || HISTORY_ADDRESS_FALLBACK;
  const when = formatHistoryWhen(item.atIso);
  const status = historyStatusLabel(item.status);
  const credit = historyCreditLabel(item.status, item.creditDelta);

  return (
    <article
      className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)]"
      data-testid="history-card"
      data-status={item.status}
      data-role={item.role}
    >
      <p className="text-sm font-semibold text-foreground">
        {historyRoleLabel(item.role)}
      </p>
      <p className="mt-0.5 truncate text-sm text-foreground" title={address}>
        {address}
      </p>
      <p className="mt-1 text-xs text-muted">{when}</p>
      <p className="mt-2 text-sm text-foreground">
        {status}
        <span className="text-muted"> · </span>
        {credit}
      </p>
    </article>
  );
}
