import { useEffect, useRef } from "react";
import { AnalyticsFilterSchema, type AnalyticsFilter } from "@wr/shared";
import { colomboToday } from "../lib/filters.js";

/** Coalesce edits and attempt each filter once; errors retry only at the user's request. */
export function useAutomaticAnalytics({
  filter,
  enabled,
  pending,
  onGenerate,
}: {
  filter: AnalyticsFilter | null;
  enabled: boolean;
  pending: boolean;
  onGenerate: () => void;
}) {
  const signature = JSON.stringify(filter);
  const attempted = useRef<string | null>(null);
  const callback = useRef(onGenerate);
  callback.current = onGenerate;
  const valid = Boolean(
    filter &&
    AnalyticsFilterSchema.safeParse(filter).success &&
    filter.to <= colomboToday(),
  );
  const waiting =
    enabled && valid && !pending && attempted.current !== signature;

  useEffect(() => {
    if (!enabled || !valid || pending || attempted.current === signature)
      return;
    const timer = window.setTimeout(() => {
      attempted.current = signature;
      callback.current();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [enabled, pending, signature, valid]);

  return {
    waiting,
    markRequested: () => {
      attempted.current = signature;
    },
  };
}
