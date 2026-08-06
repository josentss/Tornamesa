'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

export default function TurnstileWidget({ onToken, onExpire, className = '' }) {
  const ref = useRef(null);
  const widgetId = useRef(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = () => {
    if (!window.turnstile || !ref.current || !siteKey) return;
    if (widgetId.current != null) return;

    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      theme: 'dark',
      callback: (token) => onToken?.(token),
      'expired-callback': () => {
        onToken?.(null);
        onExpire?.();
      },
      'error-callback': () => {
        onToken?.(null);
      },
    });
  };

  useEffect(() => {
    if (window.turnstile) renderWidget();
    return () => {
      if (widgetId.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) {
    return (
      <p className="text-xs text-red-400">
        Captcha is not configured (missing site key).
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <div ref={ref} className={className} />
    </>
  );
}
