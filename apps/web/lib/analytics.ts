// Lightweight analytics helper. No-op until NEXT_PUBLIC_GA_ID (a GA4
// Measurement ID like G-XXXXXXXXXX) is set, so it's safe to ship disabled.
type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function track(event: string, params?: Params): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", event, params ?? {});
}
