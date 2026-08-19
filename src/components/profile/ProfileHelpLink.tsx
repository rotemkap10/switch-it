import Link from "next/link";

import {
  HelpInfoIcon,
  HelpRowChevronIcon,
} from "@/components/illustrations/HelpInfoIcon";

export function ProfileHelpLink() {
  return (
    <Link
      href="/help"
      className="profile-action-row motion-interactive-press"
      data-testid="profile-help-link"
    >
      <span className="profile-action-row__icon" aria-hidden="true">
        <HelpInfoIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          Help & Safety
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-muted">
          How Switch It works
        </span>
      </span>
      <HelpRowChevronIcon className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
