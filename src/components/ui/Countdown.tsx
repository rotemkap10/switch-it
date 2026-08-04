"use client";

import { useEffect, useRef, useState } from "react";

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
  const [readyEmphasis, setReadyEmphasis] = useState(false);
  const wasReadyRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  const target = new Date(targetIso).getTime();
  const isValidTarget = !Number.isNaN(target);
  const remainingMs = isValidTarget ? target - now : 0;
  const isReady = !isValidTarget || remainingMs <= 0;

  useEffect(() => {
    if (isReady && !wasReadyRef.current) {
      wasReadyRef.current = true;
      setReadyEmphasis(true);
      const timer = window.setTimeout(() => {
        setReadyEmphasis(false);
      }, 520);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isReady]);

  if (!isValidTarget || isReady) {
    return (
      <span
        className={[
          "countdown-value countdown-ready",
          readyEmphasis ? "motion-ready-emphasis" : "",
          className,
        ].join(" ")}
      >
        {readyLabel}
      </span>
    );
  }

  return (
    <span className={`countdown-value countdown-pending ${className}`}>
      {pendingLabel} {formatRemaining(remainingMs)}
    </span>
  );
}
