import { useEffect } from "react";
import { useLocation } from "wouter";

const SKIP_GLOBAL_SCROLL_KEY = "skip-global-scroll";
const FORCE_SCROLL_TOP_KEY = "force-scroll-top";
const DISABLE_GLOBAL_SCROLL_TOP_KEY = "disable-global-scroll-top";

function isAdminProjectFormRoute(location: string) {
  return (
    location === "/admin/projects/new" ||
    location.startsWith("/admin/projects/new?") ||
    /^\/admin\/projects\/[^/]+\/edit\/?$/.test(location) ||
    /^\/admin\/projects\/[^/]+\/edit\?/.test(location)
  );
}

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
    const globalScrollTopDisabled =
      sessionStorage.getItem(DISABLE_GLOBAL_SCROLL_TOP_KEY) === "1";

    if (globalScrollTopDisabled || isAdminProjectFormRoute(location)) {
      return;
    }

    const shouldForceTop =
      sessionStorage.getItem(FORCE_SCROLL_TOP_KEY) === "1";

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

    const shouldSkip =
      sessionStorage.getItem(SKIP_GLOBAL_SCROLL_KEY) === "1";

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
