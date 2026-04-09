import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

export function ScrollToTop() {
  const [location] = useLocation();
  const isPopNavigationRef = useRef(false);

  useEffect(() => {
    const handlePopState = () => {
      isPopNavigationRef.current = true;
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (isPopNavigationRef.current) {
      isPopNavigationRef.current = false;
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