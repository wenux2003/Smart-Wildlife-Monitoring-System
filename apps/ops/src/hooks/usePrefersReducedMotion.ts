import { useEffect, useState } from "react";

const query = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  // If motion preferences cannot be read, keep the experience static.
  const [reduced, setReduced] = useState(
    () =>
      typeof window.matchMedia !== "function" ||
      window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}
