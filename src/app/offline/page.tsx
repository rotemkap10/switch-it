import { OfflineRetryButton } from "@/components/pwa/OfflineRetryButton";

export const metadata = {
  title: "Offline — Switch It",
};

export default function OfflinePage() {
  return (
    <main className="offline-page motion-fade-slide-up">
      <div className="offline-page__card">
        <h1 className="offline-page__title">You&apos;re offline</h1>
        <p className="offline-page__body">
          Reconnect to continue finding or sharing parking.
        </p>
        <p className="offline-page__hint text-sm text-muted">
          Switch It needs a connection for live parking updates.
        </p>
        <OfflineRetryButton />
      </div>
    </main>
  );
}
