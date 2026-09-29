"use client";

/**
 * Cloudflare Turnstile client widget (Prompt2 §32).
 *
 * Renders the official Turnstile widget when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is set. Calls onVerify(token) on success — the parent form must include the
 * token in its POST so the server can verify it via verifyTurnstileToken().
 *
 * If no site key is configured, renders nothing. The corresponding server
 * verify is skipped too (see src/lib/security/turnstile.ts) — honest on both
 * sides.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          tabindex?: number;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
  }
}

interface TurnstileProps {
  onVerify?: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
  theme?: "light" | "dark" | "auto";
}

export function Turnstile({
  onVerify,
  onExpire,
  onError,
  className,
  theme = "auto",
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Avoid re-rendering when callbacks change identity.
  const cbRef = useRef({ onVerify, onExpire, onError });
  const [loaded, setLoaded] = useState(false);

  // Keep latest callbacks without re-rendering the widget.
  useEffect(() => {
    cbRef.current = { onVerify, onExpire, onError };
  }, [onVerify, onExpire, onError]);

  const renderWidget = useCallback(() => {
    if (!containerRef.current) return;
    if (!window.turnstile) return;
    if (widgetIdRef.current) return; // already rendered
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme,
      callback: (token: string) => cbRef.current.onVerify?.(token),
      "expired-callback": () => cbRef.current.onExpire?.(),
      "error-callback": () => cbRef.current.onError?.(),
    });
  }, [theme]);

  useEffect(() => {
    if (loaded) renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [loaded, renderWidget]);

  if (!SITE_KEY) {
    // HONEST: not configured → render nothing (server also skips verify).
    return null;
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
        onReady={() => setLoaded(true)}
      />
      <div ref={containerRef} className={className} data-turnstile />
    </>
  );
}
