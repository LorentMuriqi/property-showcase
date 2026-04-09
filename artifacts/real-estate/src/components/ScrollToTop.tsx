import { useEffect } from "react";
import { useLocation } from "wouter";

const SKIP_GLOBAL_SCROLL_KEY = "skip-global-scroll";
const FORCE_SCROLL_TOP_KEY = "force-scroll-top";

export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    const handlePopState = () => {
      sessionStorage.setItem(SKIP_GLOBAL_SCROLL_KEY, "1");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const shouldForceTop = sessionStorage.getItem(FORCE_SCROLL_TOP_KEY) === "1";
    if (shouldForceTop) {
      sessionStorage.removeItem(FORCE_SCROLL_TOP_KEY);
      sessionStorage.removeItem(SKIP_GLOBAL_SCROLL_KEY);

      requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "auto",
        });
      });
      return;
    }

    const shouldSkip = sessionStorage.getItem(SKIP_GLOBAL_SCROLL_KEY) === "1";
    if (shouldSkip) {
      sessionStorage.removeItem(SKIP_GLOBAL_SCROLL_KEY);
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    });
  }, [location]);

  return null;
}