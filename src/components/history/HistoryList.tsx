import {
  formatHistoryWhen,
  groupHistoryItems,
  historyCreditLabel,
  historyDayGroupLabel,
  historyRoleLabel,
  historyStatusLabel,
  HISTORY_ADDRESS_FALLBACK,
  type HistoryItem,
} from "@/lib/history/format";

type HistoryListProps = {
  items: HistoryItem[];
};

export function HistoryList({ items }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-8 text-center"
        data-testid="history-empty"
      >
        <p className="text-base font-semibold text-foreground">No activity yet</p>
        <p className="mt-1 text-sm text-muted">
          Completed handoffs will show up here with credit changes.
        </p>
      </div>
    );
  }

  const groups = groupHistoryItems(items);

  return (
    <div className="flex flex-col gap-6" data-testid="history-list">
      {groups.map(({ group, items: groupItems }) => (
        <section key={group} aria-label={historyDayGroupLabel(group)}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {historyDayGroupLabel(group)}
          </h2>
          <ul className="flex flex-col gap-2">
            {groupItems.map((item) => (
              <li key={item.id}>
                <HistoryCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
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
