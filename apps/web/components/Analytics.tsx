"use client";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { GA_ID } from "@/lib/analytics";

// Manual page_view on every route change (App Router client navigation isn't
// auto-tracked; we disable gtag's auto page_view to avoid double counting).
function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (!GA_ID || typeof window.gtag !== "function") return;
    const qs = search?.toString();
    window.gtag("event", "page_view", { page_path: pathname + (qs ? `?${qs}` : "") });
  }, [pathname, search]);
  return null;
}

export function Analytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
      </Script>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
    </>
  );
}
