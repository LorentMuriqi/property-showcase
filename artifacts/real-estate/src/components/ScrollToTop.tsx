import { useEffect } from "react";
import { useLocation } from "wouter";

const SKIP_GLOBAL_SCROLL_KEY = "skip-global-scroll";
const PROJECTS_RESTORE_SCROLL_KEY = "projects-restore-scroll";

export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    const handlePopState = () => {
      sessionStorage.setItem(SKIP_GLOBAL_SCROLL_KEY, "1");
      sessionStorage.setItem(PROJECTS_RESTORE_SCROLL_KEY, "1");
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