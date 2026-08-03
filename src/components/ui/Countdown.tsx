"use client";

import { useEffect, useState } from "react";

type CountdownProps = {
  targetIso: string;
  pendingLabel?: string;
  readyLabel?: string;
  className?: string;
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function Countdown({
  targetIso,
  pendingLabel = "Available in",
  readyLabel = "Available now",
  className = "",
}: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) {
    return (
      <span className={`countdown-ready ${className}`}>{readyLabel}</span>
    );
  }

  const remainingMs = target - now;

  if (remainingMs <= 0) {
    return (
      <span className={`countdown-ready ${className}`}>{readyLabel}</span>
    );
  }

  return (
    <span className={`countdown-pending ${className}`}>
      {pendingLabel} {formatRemaining(remainingMs)}
    </span>
  );
}
