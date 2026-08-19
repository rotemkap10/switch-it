import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";

const FLOW_STEPS = ["Share", "Claim", "Navigate", "Meet", "Confirm"] as const;

function HelpSection({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId: string;
}) {
  return (
    <Card className="help-card min-w-0" data-testid={testId}>
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted">
        {children}
      </div>
    </Card>
  );
}

export function HelpSafetyContent() {
  return (
    <div className="help-page" data-testid="help-safety-page">
      <HelpSection title="How Switch It works" testId="help-section-how">
        <ol className="help-flow" aria-label="Handoff flow">
          {FLOW_STEPS.map((step, index) => (
            <li key={step} className="help-flow__item">
              {index > 0 ? (
                <span className="help-flow__arrow" aria-hidden="true">
                  →
                </span>
              ) : null}
              <span className="help-flow__step">{step}</span>
            </li>
          ))}
        </ol>
        <p>
          A driver leaving a public street spot shares when they expect to
          leave. Another driver can claim the handoff and use{" "}
          <strong className="font-medium text-foreground">Navigate to spot</strong>{" "}
          to get there. Each tap opens Waze, Google Maps, or Apple Maps.
        </p>
      </HelpSection>

      <HelpSection title="Timing" testId="help-section-timing">
        <ul className="help-list">
          <li>
            Publisher chooses <strong className="font-medium text-foreground">Now–10 minutes</strong>
          </li>
          <li>The active handoff starts automatically at that departure time</li>
          <li>
            <strong className="font-medium text-foreground">I&apos;m leaving now</strong>{" "}
            starts it earlier. If nobody has claimed yet, the spot stays
            live and claimable for those 3 minutes.
          </li>
          <li>
            Active handoff = <strong className="font-medium text-foreground">3 minutes</strong>
          </li>
          <li>
            Publisher can{" "}
            <strong className="font-medium text-foreground">Wait 2 more min</strong>{" "}
            once — at most 5 minutes from when the handoff actually starts
          </li>
        </ul>
      </HelpSection>

      <HelpSection title="Completing the handoff" testId="help-section-complete">
        <p>
          The publisher identifies the arriving seeker&apos;s vehicle. Plates stay
          masked. Enter the seeker&apos;s{" "}
          <strong className="font-medium text-foreground">last 2 plate digits</strong>
          , then{" "}
          <strong className="font-medium text-foreground">Confirm handoff</strong>.
          Credits move only after that succeeds.
        </p>
        <p>
          Vehicle images come from the catalog for make, model, and year. A
          generic illustration is used when there is no match.
        </p>
      </HelpSection>

      <HelpSection title="Credits & cancellations" testId="help-section-credits">
        <ul className="help-list">
          <li>Claiming does not spend a credit</li>
          <li>
            Successful completion: seeker <strong className="font-medium text-foreground">−1</strong>
            , publisher <strong className="font-medium text-foreground">+1</strong>
          </li>
          <li>
            Cancel, <strong className="font-medium text-foreground">Release spot</strong>
            , or expiry = no credit transfer
          </li>
        </ul>
      </HelpSection>

      <HelpSection title="Safety & public parking" testId="help-section-safety">
        <p>
          Switch It coordinates two drivers. It does not reserve, own, or
          guarantee a public parking spot — someone else may take it first.
        </p>
        <p>
          Use the app and navigation only when it is safe and legal. Confirm
          the actual vehicle and location before completing the handoff.
        </p>
      </HelpSection>

      <HelpSection title="Something not working?" testId="help-section-tips">
        <ul className="help-list">
          <li>Check location permission</li>
          <li>Check your internet connection</li>
          <li>Reopen the app if live state looks stale</li>
          <li>Make sure the map pin is in the correct location</li>
        </ul>
      </HelpSection>
    </div>
  );
}
