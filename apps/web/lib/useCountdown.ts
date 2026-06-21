"use client";
import { useEffect, useState } from "react";

/**
 * Seconds remaining until the server-set deadline. Display only — the server is
 * authoritative (§4.2); the client never decides time, it just renders it and
 * (on the TV) nudges advance-phase when it hits zero.
 */
export function useCountdown(deadlineAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  if (!deadlineAt) return null;
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1000));
}
