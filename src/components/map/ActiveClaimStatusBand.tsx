"use client";

import { useEffect, useRef, useState } from "react";

import { Countdown } from "@/components/ui/Countdown";

type ActiveClaimStatusBandProps = {
  spotAvailableAt: string;
  spotAddress: string | null;
};

export function ActiveClaimStatusBand({
  spotAvailableAt,
  spotAddress,
}: ActiveClaimStatusBandProps) {
  const [now, setNow] = useState(() => Date.now());
  const [readyEmphasis, setReadyEmphasis] = useState(false);
  const wasReadyRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  const target = new Date(spotAvailableAt).getTime();
  const isReady = !Number.isNaN(target) && target - now <= 0;

  useEffect(() => {
    if (isReady && !wasReadyRef.current) {
      wasReadyRef.current = true;
      setReadyEmphasis(true);
      const timer = window.setTimeout(() => setReadyEmphasis(false), 520);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isReady]);

  return (
    <div
      className={[
        "status-band px-4 py-3",
        isReady ? "status-band-ready" : "",
        readyEmphasis ? "motion-ready-emphasis" : "",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-accent-hover">
        You’re on your way
      </p>
      <h2 className="mt-1 text-xl font-semibold text-foreground">
        {spotAddress?.trim()
          ? spotAddress
          : "Public street parking spot"}
      </h2>
      <p className="mt-3 text-lg">
        <Countdown
          targetIso={spotAvailableAt}
          pendingLabel="Available in"
          readyLabel="Available now"
        />
      </p>
    </div>
  );
}
