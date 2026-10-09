import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion.js";
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
  const reduced = usePrefersReducedMotion();
  return reduced ? (
    <div>{children}</div>
  ) : (
    <FadeContent duration={750} delay={delay} blur threshold={0.05}>
      {children}
    </FadeContent>
  );
}
