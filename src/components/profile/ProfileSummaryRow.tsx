"use client";

import { EmailMarkIcon } from "@/components/illustrations/UserInitialAvatar";
import { CreditsSummaryCard } from "@/components/profile/CreditsSummaryCard";
import { Card } from "@/components/ui/Card";

type ProfileSummaryRowProps = {
  email: string | null | undefined;
  credits: number;
};

export function ProfileSummaryRow({
  email,
  credits,
}: ProfileSummaryRowProps) {
  return (
    <div className="profile-summary-grid" data-testid="profile-summary-row">
      <Card className="profile-summary-card">
        <CreditsSummaryCard credits={credits} />
      </Card>

      <Card className="profile-summary-card">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Email
          </p>
          <EmailMarkIcon className="h-5 w-5 shrink-0" />
        </div>
        <p
          className="mt-auto break-all text-sm leading-snug text-foreground sm:text-[0.9375rem]"
          data-testid="profile-email-value"
        >
          {email?.trim() ? email : "—"}
        </p>
      </Card>
    </div>
  );
}
