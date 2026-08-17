import { useEffect, useRef } from "react";

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string | null) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export default function TurnstileWidget({
  siteKey,
  onVerify,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onVerify);

  useEffect(() => {
    callbackRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    let widgetId: string | null = null;
    let timer: number | undefined;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current) return;

      if (!window.turnstile) {
        timer = window.setTimeout(renderWidget, 100);
        return;
      }

      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        appearance: "always", //always ose interaction-only

        callback: (token) => {
          callbackRef.current(token);
        },

        "expired-callback": () => {
          callbackRef.current(null);
        },

        "error-callback": () => {
          callbackRef.current(null);
        },
      });
    };

    renderWidget();

    return () => {
      cancelled = true;

      if (timer) {
        window.clearTimeout(timer);
      }

      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [siteKey]);

  return <div ref={containerRef} />;
}