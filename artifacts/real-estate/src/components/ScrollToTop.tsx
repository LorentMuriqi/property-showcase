import { useEffect } from "react";
import { useLocation } from "wouter";

const SKIP_GLOBAL_SCROLL_KEY = "skip-global-scroll";

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
    const shouldSkip = sessionStorage.getItem(SKIP_GLOBAL_SCROLL_KEY) === "1";

    if (shouldSkip) {
      sessionStorage.removeItem(SKIP_GLOBAL_SCROLL_KEY);
      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location]);

  return null;
}