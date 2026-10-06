import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import FadeContent from "./react-bits/FadeContent.js";

// React Bits FadeContent, with an accessible reduced-motion alternative.
export function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced ? (
    <div>{children}</div>
  ) : (
    <FadeContent duration={750} delay={delay} blur threshold={0.05}>
      {children}
    </FadeContent>
  );
}
