import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion.js";

export function useCountUp(value: number | null): number {
  const reduced = usePrefersReducedMotion();
  const [displayed, setDisplayed] = useState(() =>
    reduced ? (value ?? 0) : 0,
  );
  const current = useRef(displayed);
  useEffect(() => {
    const target = value ?? 0;
    if (reduced || value === null) {
      current.current = target;
      setDisplayed(target);
      return;
    }
    const from = current.current;
    if (from === target) return;
    const started = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - started) / 700));
      current.current =
        from + (target - from) * (1 - Math.pow(1 - progress, 3));
      setDisplayed(current.current);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value, reduced]);
  return reduced ? (value ?? 0) : displayed;
}
